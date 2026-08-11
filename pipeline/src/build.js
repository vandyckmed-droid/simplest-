// Pipeline entry point.
//
//   node pipeline/src/build.js
//
// Produces reusable artifacts in data/ and a compact bundle in app/data/.
// The artifacts are deliberately plain JSON: any other view - a healthcare-only
// build, a desktop dashboard, a notebook - can consume them without touching
// this file.

import fs from 'node:fs/promises';
import path from 'node:path';

import { fmpGet, LOGO_URL } from './fmp.js';
import { log } from './log.js';
import { fetchScreener, pickCandidates, fetchProfiles, dedupe, selectTopPerSector } from './universe.js';
import { fetchMany, describeBars, alignToCalendar } from './prices.js';

import { computeMomentum, scoresFrom, rankUniverse, HORIZONS, BLEND_WEIGHTS } from '../../app/src/analytics/momentum.js';
import { atr, atrPercent } from '../../app/src/analytics/atr.js';
import { equalWeightSeries, groupsAtLeast } from '../../app/src/analytics/sectors.js';
import { maxDrawdown, totalReturn } from '../../app/src/analytics/returns.js';
import { isNum } from '../../app/src/analytics/stats.js';

const ROOT = path.resolve('.');
const DATA_DIR = path.join(ROOT, 'data');
const PRICES_DIR = path.join(DATA_DIR, 'prices');
const APP_DATA_DIR = path.join(ROOT, 'app', 'data');

const round = (x, dp = 6) => (isNum(x) ? Number(x.toFixed(dp)) : null);

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data), 'utf8');
  const { size } = await fs.stat(file);
  log.done(`${path.relative(ROOT, file)} (${(size / 1024).toFixed(0)} KB)`);
}

function isoDaysAgo(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const started = Date.now();
  const config = JSON.parse(await fs.readFile(path.join(ROOT, 'config', 'universe.config.json'), 'utf8'));

  const to = new Date().toISOString().slice(0, 10);
  const from = isoDaysAgo(config.history.years);

  // ---------------------------------------------------------------- universe
  log.step('Screening the market');
  const screened = await fetchScreener(config, log);
  if (screened.length === 0) throw new Error('screener returned nothing; cannot build a universe');
  log.done(`${screened.length} screened names across ${config.sectors.length} sectors`);

  const candidates = pickCandidates(screened, config);
  log.done(`${candidates.length} candidates carried forward`);

  // ------------------------------------------------------------------ prices
  log.step(`Fetching ${config.history.years}y of adjusted daily history`);
  const histories = await fetchMany(candidates.map((c) => c.symbol), from, to, log);
  const barsBySymbol = new Map();
  const dataIssues = [];
  histories.forEach((h, i) => {
    const symbol = candidates[i].symbol;
    if (!h || !h.ok) {
      dataIssues.push({ symbol, stage: 'history', reason: h ? h.error : 'no response' });
      return;
    }
    barsBySymbol.set(symbol, h.bars);
    const iss = h.issues || {};
    if (iss.duplicateDates || iss.badRows || iss.repairedHighLow) {
      dataIssues.push({
        symbol,
        stage: 'cleaning',
        reason: `${iss.duplicateDates} duplicate dates, ${iss.badRows} unusable rows, ${iss.repairedHighLow} repaired high/low`,
      });
    }
  });
  log.done(`history for ${barsBySymbol.size}/${candidates.length} candidates`);

  // Attach the liquidity facts measured from real bars.
  const enriched = candidates
    .filter((c) => barsBySymbol.has(c.symbol))
    .map((c) => ({ ...c, ...describeBars(barsBySymbol.get(c.symbol), config.liquidity.lookbackDays) }));

  // ---------------------------------------------------------------- profiles
  log.step('Fetching company profiles');
  const profiles = await fetchProfiles(enriched.map((c) => c.symbol), log);

  log.step('Removing duplicate listings and share classes');
  const { kept, dropped } = dedupe(enriched, profiles);
  log.done(`${dropped.length} duplicate lines folded away`);
  for (const d of dropped.slice(0, 10)) log.info(`${d.symbol} → kept ${d.keptInstead}`);

  // --------------------------------------------------------------- selection
  log.step('Applying liquidity gates and selecting the universe');
  const { selected, excluded, sectorReport } = selectTopPerSector(kept, config);
  for (const s of sectorReport) {
    const flag = s.selected < s.target ? ` (short of ${s.target})` : '';
    log.info(`${s.sector.padEnd(24)} ${String(s.selected).padStart(3)} selected from ${s.eligible} eligible${flag}`);
  }
  log.done(`${selected.length} securities in the universe`);

  // ------------------------------------------------------ benchmark + macro
  log.step('Fetching benchmark and macro series');
  const macroSpecs = config.macro;
  const macroResolved = [];
  for (const spec of macroSpecs) {
    const chain = [spec.symbol, ...(spec.fallbacks || [])];
    let picked = null;
    for (const sym of chain) {
      const h = await fetchHistoryFor(sym, from, to);
      if (h) {
        picked = { ...spec, resolvedSymbol: sym, bars: h, substituted: sym !== spec.symbol };
        if (sym !== spec.symbol) log.warn(`${spec.label}: ${spec.symbol} unavailable, using ${sym}`);
        break;
      }
    }
    if (picked) macroResolved.push(picked);
    else log.warn(`${spec.label}: no usable series, dropping from the macro board`);
  }

  const benchmarkBars = await fetchHistoryFor(config.benchmark.symbol, from, to);
  if (!benchmarkBars) log.warn(`benchmark ${config.benchmark.symbol} unavailable`);

  // ---------------------------------------------------------------- metrics
  log.step('Computing momentum, volatility and ATR');
  const rows = selected.map((s) => {
    const bars = barsBySymbol.get(s.symbol);
    const closes = bars.map((b) => b.close);
    const momentum = computeMomentum(closes);
    const scores = scoresFrom(momentum);
    const p = profiles.get(s.symbol) || {};

    const coverage = [];
    if (!momentum.h12_1) coverage.push('no 12-1 score: fewer than 253 daily bars');
    if (!momentum.h6_1) coverage.push('no 6-1 score: fewer than 127 daily bars');

    return {
      symbol: s.symbol,
      name: p.name || s.name,
      sector: s.sector,
      industry: p.industry || s.industry || null,
      exchange: p.exchange || s.exchange,
      marketCap: s.marketCap,
      beta: isNum(s.beta) ? round(s.beta, 3) : null,
      lastClose: round(s.lastClose, 4),
      medianDollarVolume: Math.round(s.medianDollarVolume),
      bars: s.bars,
      firstDate: s.firstDate,
      lastDate: s.lastDate,
      ipoDate: p.ipoDate || null,
      website: p.website || null,
      description: p.description || null,
      employees: p.employees || null,
      logo: LOGO_URL(s.symbol),
      scores: {
        score12: round(scores.score12, 4),
        score6: round(scores.score6, 4),
        blended: round(scores.blended, 4),
      },
      components: {
        h12_1: momentum.h12_1
          ? {
              totalReturn: round(momentum.h12_1.totalReturn, 5),
              annReturn: round(momentum.h12_1.annReturn, 5),
              annVol: round(momentum.h12_1.annVol, 5),
              windowDays: momentum.h12_1.windowDays,
              observations: momentum.h12_1.observations,
            }
          : null,
        h6_1: momentum.h6_1
          ? {
              totalReturn: round(momentum.h6_1.totalReturn, 5),
              annReturn: round(momentum.h6_1.annReturn, 5),
              annVol: round(momentum.h6_1.annVol, 5),
              windowDays: momentum.h6_1.windowDays,
              observations: momentum.h6_1.observations,
            }
          : null,
      },
      atr14: round(atr(bars, 14), 4),
      atrPct: round(atrPercent(bars, 14), 5),
      return1m: round(totalReturn(closes, 21, 0), 5),
      return3m: round(totalReturn(closes, 63, 0), 5),
      return12m: round(totalReturn(closes, 252, 0), 5),
      maxDrawdown1y: round(maxDrawdown(closes.slice(-252)), 5),
      coverage,
    };
  });

  const ranked = rankUniverse(rows, 'sector');

  // Industry ranks reuse the identical framework, keyed on industry instead.
  const bigIndustries = groupsAtLeast(ranked, 'industry', config.industries.minCountToTag);
  const bigIndustryNames = new Set(bigIndustries.map((g) => g.name));
  const industryRanked = rankUniverse(
    ranked.map((r) => ({ ...r, _ind: bigIndustryNames.has(r.industry) ? r.industry : null })),
    '_ind'
  );
  industryRanked.forEach((r, i) => {
    ranked[i].industryRanks = bigIndustryNames.has(r.industry)
      ? {
          score12: { rank: r.ranks.score12.group, of: r.ranks.score12.groupOf, z: round(r.ranks.score12.groupZ, 3) },
          score6: { rank: r.ranks.score6.group, of: r.ranks.score6.groupOf, z: round(r.ranks.score6.groupZ, 3) },
          blended: { rank: r.ranks.blended.group, of: r.ranks.blended.groupOf, z: round(r.ranks.blended.groupZ, 3) },
        }
      : null;
  });

  // Round the z-scores that came back from the sector pass.
  for (const r of ranked) {
    for (const k of ['score12', 'score6', 'blended']) r.ranks[k].groupZ = round(r.ranks[k].groupZ, 3);
  }
  log.done(`${bigIndustries.length} industries reached the ${config.industries.minCountToTag}-name threshold`);

  // -------------------------------------------------- shared trading calendar
  log.step('Aligning every series onto one trading calendar');
  const seriesInput = {};
  for (const r of ranked) seriesInput[r.symbol] = barsBySymbol.get(r.symbol);
  for (const m of macroResolved) seriesInput[m.resolvedSymbol] = m.bars;
  if (benchmarkBars) seriesInput[config.benchmark.symbol] = benchmarkBars;
  // Equity lines define the calendar; macro instruments are sampled onto it.
  const calendarSymbols = ranked.map((r) => r.symbol);
  if (benchmarkBars) calendarSymbols.push(config.benchmark.symbol);
  const { dates, closes } = alignToCalendar(seriesInput, calendarSymbols);
  log.done(`${dates.length} trading days, ${dates[0]} → ${dates[dates.length - 1]}`);

  // ---------------------------------------------------------- sector indices
  log.step('Building equal-weight sector series');
  const sectorSeries = [];
  for (const sector of config.sectors) {
    const members = ranked.filter((r) => r.sector === sector).map((r) => r.symbol);
    if (members.length === 0) continue;
    const s = equalWeightSeries(dates, closes, members);
    sectorSeries.push({ key: sector, label: sector, kind: 'sector', members, values: s.values, membership: s.membership });
  }

  const industrySeries = [];
  for (const ind of bigIndustries) {
    const members = ranked.filter((r) => r.industry === ind.name).map((r) => r.symbol);
    const s = equalWeightSeries(dates, closes, members);
    industrySeries.push({ key: ind.name, label: ind.name, kind: 'industry', members, values: s.values, membership: s.membership });
  }

  // Sector and industry indices are ranked with exactly the same framework as
  // individual stocks, so the two views speak the same language.
  function rankSeries(list, groupLabel) {
    const asRows = list.map((s) => {
      const m = computeMomentum(s.values.filter(isNum));
      return { symbol: s.key, sector: groupLabel, scores: scoresFrom(m), momentum: m, series: s };
    });
    const r = rankUniverse(asRows, 'sector');
    return r.map((row) => {
      const s = row.series;
      const m = row.momentum;
      const vals = s.values;
      return {
        key: s.key,
        label: s.label,
        kind: s.kind,
        constituents: s.members.length,
        members: s.members,
        scores: {
          score12: round(row.scores.score12, 4),
          score6: round(row.scores.score6, 4),
          blended: round(row.scores.blended, 4),
        },
        components: {
          h12_1: m.h12_1 ? { annReturn: round(m.h12_1.annReturn, 5), annVol: round(m.h12_1.annVol, 5), totalReturn: round(m.h12_1.totalReturn, 5) } : null,
          h6_1: m.h6_1 ? { annReturn: round(m.h6_1.annReturn, 5), annVol: round(m.h6_1.annVol, 5), totalReturn: round(m.h6_1.totalReturn, 5) } : null,
        },
        ranks: {
          score12: { rank: row.ranks.score12.global, of: row.ranks.score12.globalOf, z: round(row.ranks.score12.groupZ, 3) },
          score6: { rank: row.ranks.score6.global, of: row.ranks.score6.globalOf, z: round(row.ranks.score6.groupZ, 3) },
          blended: { rank: row.ranks.blended.global, of: row.ranks.blended.globalOf, z: round(row.ranks.blended.groupZ, 3) },
        },
        return1m: round(totalReturn(vals, 21, 0), 5),
        return3m: round(totalReturn(vals, 63, 0), 5),
        return12m: round(totalReturn(vals, 252, 0), 5),
        values: vals.map((v) => round(v, 3)),
        membership: s.membership,
      };
    });
  }

  const sectorsRanked = rankSeries(sectorSeries, 'ALL_SECTORS');
  const industriesRanked = rankSeries(industrySeries, 'ALL_INDUSTRIES');
  log.done(`${sectorsRanked.length} sector indices, ${industriesRanked.length} industry indices`);

  // -------------------------------------------------------------- macro board
  const macro = macroResolved.map((m) => {
    const vals = closes[m.resolvedSymbol];
    const clean = vals.filter(isNum);
    return {
      key: m.key,
      label: m.label,
      sublabel: m.substituted ? `${m.resolvedSymbol} (stand-in)` : m.sublabel,
      symbol: m.resolvedSymbol,
      requestedSymbol: m.symbol,
      substituted: m.substituted,
      note: m.note || null,
      last: round(clean[clean.length - 1], 4),
      return1d: round(totalReturn(clean, 1, 0), 5),
      return1m: round(totalReturn(clean, 21, 0), 5),
      return3m: round(totalReturn(clean, 63, 0), 5),
      return12m: round(totalReturn(clean, 252, 0), 5),
      values: vals.map((v) => round(v, 4)),
    };
  });

  // ----------------------------------------------------------------- outputs
  log.step('Writing reusable artifacts');

  const tradingDate = dates[dates.length - 1];
  const manifest = {
    builtAt: new Date().toISOString(),
    tradingDate,
    provider: 'Financial Modeling Prep (/stable)',
    referenceSources: [
      { name: 'Financial Modeling Prep', use: 'prices, fundamentals, screener, logos' },
      { name: 'Company websites', use: 'linked from each ticker profile' },
      { name: 'Wikipedia', use: 'linked from each ticker for background reading' },
    ],
    calendar: { days: dates.length, first: dates[0], last: tradingDate },
    counts: {
      screened: screened.length,
      candidates: candidates.length,
      afterDedupe: kept.length,
      universe: ranked.length,
      sectors: sectorsRanked.length,
      industriesTagged: industriesRanked.length,
      macro: macro.length,
    },
    config,
    methodology: {
      horizons: HORIZONS,
      blendWeights: BLEND_WEIGHTS,
      priceBasis: 'Dividend- and split-adjusted daily closes',
      volatility: 'Standard deviation of daily log returns over the same window as the return, × √252',
      returnAnnualisation: 'Geometric: (1 + total return) ^ (252 / window days) − 1',
      atr: "Wilder's 14-period ATR on adjusted OHLC",
      sectorIndices: 'Equal weight, rebalanced daily, rebased to 100 at the start of the calendar',
      ranking: 'Standard competition ranking, 1 = best: ties share a rank and the following rank numbers are skipped. Sector-relative z-scores use that sector as the peer group.',
    },
    dataQuality: {
      duplicatesDropped: dropped,
      excludedByGate: excluded.slice(0, 200),
      excludedCount: excluded.length,
      issues: dataIssues,
      warnings: log.warnings(),
    },
    sectorReport,
  };

  await writeJson(path.join(DATA_DIR, 'manifest.json'), manifest);
  await writeJson(path.join(DATA_DIR, 'universe.json'), ranked);
  await writeJson(path.join(DATA_DIR, 'sectors.json'), { sectors: sectorsRanked, industries: industriesRanked, dates });
  await writeJson(path.join(DATA_DIR, 'macro.json'), { macro, dates });

  // Per-ticker full OHLCV, so rankings, charts, volatility, ATR and sector
  // series can all be recomputed locally without re-downloading anything.
  await fs.mkdir(PRICES_DIR, { recursive: true });
  for (const r of ranked) {
    const bars = barsBySymbol.get(r.symbol);
    await fs.writeFile(
      path.join(PRICES_DIR, `${r.symbol}.json`),
      JSON.stringify({
        symbol: r.symbol,
        source: 'dividend-adjusted daily',
        first: bars[0].date,
        last: bars[bars.length - 1].date,
        fields: ['date', 'open', 'high', 'low', 'close', 'volume'],
        bars: bars.map((b) => [b.date, round(b.open, 4), round(b.high, 4), round(b.low, 4), round(b.close, 4), b.volume]),
      }),
      'utf8'
    );
  }
  log.done(`data/prices/ — ${ranked.length} per-ticker files`);

  // --------------------------------------------------------------- app bundle
  log.step('Packing the phone bundle');
  const chartDays = config.appBundle.chartDays;
  const bundleDates = dates.slice(-chartDays);
  const sliceTail = (arr) => arr.slice(-chartDays);

  const priceBundle = { dates: bundleDates, closes: {} };
  for (const r of ranked) priceBundle.closes[r.symbol] = sliceTail(closes[r.symbol]).map((v) => round(v, 3));
  if (benchmarkBars) priceBundle.closes[config.benchmark.symbol] = sliceTail(closes[config.benchmark.symbol]).map((v) => round(v, 3));

  const core = {
    manifest: {
      builtAt: manifest.builtAt,
      tradingDate,
      provider: manifest.provider,
      calendar: manifest.calendar,
      counts: manifest.counts,
      methodology: manifest.methodology,
      config: {
        perSector: config.perSector,
        liquidity: config.liquidity,
        history: config.history,
        industries: config.industries,
        selection: config.selection,
        screen: config.screen,
      },
      dataQuality: {
        duplicatesDropped: dropped.length,
        excludedCount: excluded.length,
        issueCount: dataIssues.length,
        warnings: manifest.dataQuality.warnings,
        shortHistory: ranked.filter((r) => r.coverage.length > 0).map((r) => ({ symbol: r.symbol, coverage: r.coverage })),
      },
      sectorReport,
    },
    benchmark: config.benchmark,
    universe: ranked.map(({ description, ...rest }) => ({
      ...rest,
      description: description ? description.slice(0, 420) : null,
    })),
    sectors: sectorsRanked.map((s) => ({ ...s, values: sliceTail(s.values), membership: sliceTail(s.membership) })),
    industries: industriesRanked.map((s) => ({ ...s, values: sliceTail(s.values), membership: sliceTail(s.membership) })),
    macro: macro.map((m) => ({ ...m, values: sliceTail(m.values) })),
    dates: bundleDates,
  };

  await writeJson(path.join(APP_DATA_DIR, 'core.json'), core);
  await writeJson(path.join(APP_DATA_DIR, 'prices.json'), priceBundle);

  log.step(`Build complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  log.info(`universe ${ranked.length} · trading date ${tradingDate} · warnings ${log.warnings().length}`);
}

async function fetchHistoryFor(symbol, from, to) {
  const { fetchHistory } = await import('./prices.js');
  const r = await fetchHistory(symbol, from, to);
  return r.ok ? r.bars : null;
}

main().catch((err) => {
  console.error(`\nBuild failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
