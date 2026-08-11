// Universe construction.
//
// Screener -> candidates -> profiles -> dedupe -> liquidity gate -> top N per sector.
// Widening the universe is a config edit; nothing here is hard-coded to 25 or to
// a particular sector list.

import { fmpGet, mapLimit } from './fmp.js';

// Share-class and listing noise that should not make two lines look like two
// different companies.
const NAME_NOISE = /\b(class\s+[a-z]|cl\s+[a-z]|series\s+[a-z]|common stock|ordinary shares|inc\.?|incorporated|corp\.?|corporation|company|co\.?|ltd\.?|limited|plc|holdings?|group|the)\b/gi;

function normaliseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(NAME_NOISE, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchScreener(config, log) {
  const screen = config.screen;
  const rows = [];
  const seen = new Set();

  // One request per sector keeps each response small and makes a single sector
  // failure survivable.
  for (const sector of config.sectors) {
    const res = await fmpGet('company-screener', {
      sector,
      marketCapMoreThan: screen.minMarketCap,
      volumeMoreThan: screen.minScreenerVolume,
      exchange: screen.exchanges.join(','),
      country: screen.country,
      isEtf: screen.excludeEtf ? false : undefined,
      isFund: screen.excludeFund ? false : undefined,
      isActivelyTrading: screen.activelyTradingOnly ? true : undefined,
      limit: 3000,
    });

    if (!res.ok || !Array.isArray(res.data)) {
      log.warn(`screener failed for ${sector}: ${res.error || 'unexpected shape'}`);
      continue;
    }

    let kept = 0;
    for (const r of res.data) {
      if (!r.symbol || seen.has(r.symbol)) continue;
      // Defend against the screener ignoring a filter.
      if (r.isEtf || r.isFund) continue;
      if (screen.activelyTradingOnly && r.isActivelyTrading === false) continue;
      if (!r.sector) continue;
      // Units, warrants and rights are not common stock.
      if (/[.\-][UWR]$/.test(r.symbol) || r.symbol.includes('.')) continue;
      seen.add(r.symbol);
      rows.push({
        symbol: r.symbol,
        name: r.companyName,
        sector: r.sector,
        industry: r.industry || null,
        marketCap: r.marketCap,
        beta: r.beta,
        exchange: r.exchangeShortName || r.exchange,
        screenerVolume: r.volume,
        screenerPrice: r.price,
      });
      kept += 1;
    }
    log.info(`screener ${sector}: ${kept} candidates`);
  }
  return rows;
}

// Keeps the largest `candidateMultiple × perSector` names per sector, so there is
// slack for names that later fail the liquidity or history gates.
export function pickCandidates(rows, config) {
  const perSector = Math.ceil(config.perSector * config.candidateMultiple);
  const bySector = new Map();
  for (const r of rows) {
    if (!bySector.has(r.sector)) bySector.set(r.sector, []);
    bySector.get(r.sector).push(r);
  }
  const out = [];
  for (const [, list] of bySector) {
    list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    out.push(...list.slice(0, perSector));
  }
  return out;
}

export async function fetchProfiles(symbols, log) {
  const profiles = new Map();
  await mapLimit(symbols, 8, async (symbol) => {
    const res = await fmpGet('profile', { symbol });
    if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return;
    const p = res.data[0];
    profiles.set(symbol, {
      symbol,
      name: p.companyName,
      sector: p.sector,
      industry: p.industry,
      exchange: p.exchange,
      currency: p.currency,
      cik: p.cik || null,
      isin: p.isin || null,
      country: p.country,
      website: p.website || null,
      description: p.description || null,
      ceo: p.ceo || null,
      employees: p.fullTimeEmployees || null,
      ipoDate: p.ipoDate || null,
      marketCap: p.marketCap,
      beta: p.beta,
      averageVolume: p.averageVolume,
      price: p.price,
      isAdr: Boolean(p.isAdr),
      isActivelyTrading: p.isActivelyTrading !== false,
    });
  });
  log.info(`profiles fetched: ${profiles.size}/${symbols.length}`);
  return profiles;
}

/**
 * Collapses multiple share classes of one company into a single line.
 *
 * Companies are matched on CIK when the provider supplies one, and on a
 * normalised company name otherwise. The most liquid line wins; the rest are
 * recorded so the build report can show exactly what was folded away.
 */
export function dedupe(rows, profiles) {
  const groups = new Map();

  for (const r of rows) {
    const p = profiles.get(r.symbol);
    const cik = p && p.cik ? `cik:${p.cik}` : null;
    const key = cik || `name:${normaliseName(p ? p.name : r.name)}` || `sym:${r.symbol}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const kept = [];
  const dropped = [];
  for (const [, list] of groups) {
    if (list.length === 1) {
      kept.push(list[0]);
      continue;
    }
    // Prefer the line that actually trades: dollar volume, then market cap.
    list.sort((a, b) => {
      const dvA = (a.medianDollarVolume || 0) - (b.medianDollarVolume || 0);
      if (dvA !== 0) return -dvA;
      return (b.marketCap || 0) - (a.marketCap || 0);
    });
    kept.push(list[0]);
    for (const other of list.slice(1)) {
      dropped.push({ symbol: other.symbol, keptInstead: list[0].symbol, reason: 'duplicate listing / share class' });
    }
  }
  return { kept, dropped };
}

// Final selection: apply the liquidity gate, then take the largest survivors.
export function selectTopPerSector(rows, config) {
  const { minMedianDollarVolume, minPrice, minTradedDaysRatio } = config.liquidity;
  const minBars = config.history.minBarsRequired;

  const excluded = [];
  const eligible = [];

  for (const r of rows) {
    const reasons = [];
    if (!r.bars || r.bars < minBars) reasons.push(`only ${r.bars || 0} daily bars (need ${minBars})`);
    if (!(r.lastClose >= minPrice)) reasons.push(`price $${r.lastClose ?? '?'} below $${minPrice}`);
    if (!(r.medianDollarVolume >= minMedianDollarVolume)) {
      reasons.push(`median dollar volume too thin`);
    }
    if (r.tradedDaysRatio !== undefined && r.tradedDaysRatio < minTradedDaysRatio) {
      reasons.push('too many non-trading days');
    }
    if (reasons.length) excluded.push({ symbol: r.symbol, sector: r.sector, reasons });
    else eligible.push(r);
  }

  const bySector = new Map();
  for (const r of eligible) {
    if (!bySector.has(r.sector)) bySector.set(r.sector, []);
    bySector.get(r.sector).push(r);
  }

  const selected = [];
  const sectorReport = [];
  for (const sector of config.sectors) {
    const list = bySector.get(sector) || [];
    const rankBy = config.selection.rankBy === 'dollarVolume' ? 'medianDollarVolume' : 'marketCap';
    list.sort((a, b) => (b[rankBy] || 0) - (a[rankBy] || 0));
    const take = list.slice(0, config.perSector);
    selected.push(...take);
    sectorReport.push({ sector, eligible: list.length, selected: take.length, target: config.perSector });
  }

  return { selected, excluded, sectorReport };
}
