// Inlines data/ranks.json into src/ranks-template.html and writes
// dist/ranks.html.
//
//   node src/ranks-render.js

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const round = (v, dp) => (Number.isFinite(v) ? Number(v.toFixed(dp)) : null);

// FMP names carry share-class and legal-form boilerplate that eats the one line
// of width a phone gives the company name.
const CLASS = /\s+(Class\s+[A-Z]\s+)?(Common\s+(Stock|Shares)|Ordinary\s+Shares)$/i;
const LEGAL = /,?\s+(Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.|Ltd\.?|Limited|plc|PLC|LLC|L\.P\.|LP|N\.V\.|S\.A\.)$/;
// Stripped by default, but put back when dropping it would leave nothing but
// the ticker: "PACS Group" earns its line where a bare "PACS" does not.
const SUFFIX = /,?\s+(Holdings?|Group)$/;

// Long words that survive the legal-form strip and still eat the one line of
// width a phone gives the name. Only unambiguous ones — a reader has to
// recognise the company at a glance, so "American" stays "American".
const SHORTEN = [
  [/\bTechnolog(y|ies)\b/g, 'Tech'],
  [/\bPharmaceuticals?\b/g, 'Pharma'],
  [/\bTherapeutics\b/g, 'Thera'],
  [/\bCommunications?\b/g, 'Comms'],
  [/\bInternational\b/g, 'Intl'],
  [/\bIndustries\b/g, 'Inds'],
  [/\bIncorporated\b/g, ''],
  [/\bLaboratories\b/g, 'Labs'],
  [/\bManagement\b/g, 'Mgmt'],
  [/\bManufacturing\b/g, 'Mfg'],
  [/\bResources\b/g, 'Res'],
  [/\bSolutions\b/g, 'Solns'],
  [/\bServices\b/g, 'Svcs'],
  [/\bFinancial\b/g, 'Finl'],
  [/\bProperties\b/g, 'Props'],
  [/\bEntertainment\b/g, 'Entmt'],
  [/\bEnterprises\b/g, 'Entpr'],
  [/\bInstruments\b/g, 'Instr'],
  [/\bDevelopment\b/g, 'Devt'],
  [/\bSemiconductors?\b/g, 'Semi'],
  [/\bNational\b/g, 'Natl'],
  [/\bAssociates\b/g, 'Assoc'],
  [/\bPartners\b/g, 'Ptnrs'],
  [/\bCommercial\b/g, 'Comml'],
  [/\bEquipment\b/g, 'Equip'],
  [/\bTransportation\b/g, 'Transp'],
];

function strip(name, dropSuffix) {
  let out = name.trim();
  for (let pass = 0; pass < 3; pass++) {
    const before = out;
    out = out.replace(CLASS, '').trim().replace(LEGAL, '').trim();
    if (dropSuffix) out = out.replace(SUFFIX, '').trim();
    if (out === before) break;
  }
  for (const [re, to] of SHORTEN) out = out.replace(re, to);
  // Stripping "Company" off "Wells Fargo & Company" leaves a dangling ampersand.
  return out.replace(/\s{2,}/g, ' ').replace(/[,\s]*(&|and)$/i, '').replace(/[,\s]+$/, '').trim() || name;
}

/**
 * The company name as the row shows it, or "" when there is nothing left to
 * say. 65 of the universe's names tidy down to their own ticker — Roku Inc. to
 * "Roku", CSX Corporation to "CSX" — and a line repeating the ticker in grey
 * underneath it reads as a bug. Backing the suffix strip off first rescues the
 * ones with a real word in them; the rest lose the line.
 */
function tidyName(name, symbol) {
  const same = (a) => a.toUpperCase() === symbol.toUpperCase();
  const full = strip(name, true);
  if (!same(full)) return full;
  const kept = strip(name, false);
  return same(kept) ? '' : kept;
}

const data = JSON.parse(await readFile(new URL('../data/ranks.json', import.meta.url), 'utf8'));
const etfData = JSON.parse(await readFile(new URL('../data/etfs.json', import.meta.url), 'utf8'));
const { ETF_HOLDINGS } = await import('./etf-holdings.js');

// Holdings resolve against the stock universe here, at build time, so the page
// carries an index rather than doing a symbol lookup per render. -1 means the
// name is not in the stock universe — kept and marked rather than dropped.
const stockRow = new Map(data.stocks.map((s, i) => [s.symbol, i]));
const holdingsFor = (symbol) => {
  const entry = ETF_HOLDINGS[symbol];
  if (!entry) return undefined;
  return entry.holdings.map(([sym, wt, note]) => {
    const at = stockRow.has(sym) ? stockRow.get(sym) : -1;
    // A note only matters for a name that misses; carrying one for a name that
    // resolved would just bloat the payload.
    return at >= 0 ? [sym, wt, at] : [sym, wt, -1, note ?? 'not in the stock universe'];
  });
};

const mappedFunds = etfData.funds.filter((f) => ETF_HOLDINGS[f.symbol]).length;
for (const symbol of Object.keys(ETF_HOLDINGS)) {
  if (!etfData.funds.some((f) => f.symbol === symbol)) {
    console.warn(`  holdings listed for ${symbol}, which is not a scored fund`);
  }
}

// Annualised return and volatility at every skip x lookback, flattened
// skip-major over skips [0, 10, 21] and lookbacks [252, 126]. The page derives
// score = rt/vl and blend = mean of the two lookbacks' scores, so a third array
// would just be a division it can do itself.
const windows = (s) => ({
  rt: s.rt.map((v) => round(v, 3)),
  vl: s.vl.map((v) => round(v, 3)),
});

// Both universes ship in one page. Each carries its own grouping — sectors for
// stocks, themes for funds — and the page reads whichever is active.
const sectors = data.sectors.map((s) => s.name);
const sectorIndex = new Map(sectors.map((name, i) => [name, i]));
const themeIndex = new Map(etfData.themes.map((name, i) => [name, i]));

const compact = {
  asOf: data.asOf,
  universes: {
    stocks: {
      label: 'Stocks',
      groupLabel: 'All sectors',
      groups: sectors,
      hasCap: true,
      items: data.stocks.map((s) => ({
        symbol: s.symbol,
        name: tidyName(s.name, s.symbol),
        k: sectorIndex.get(s.sector) ?? 0,
        m: Math.round(s.marketCap / 1e6), // $M; the page ranks on it for the cap filter
        ...windows(s),
        c: s.corr, // base64 return vector, for the basket filler
      })),
    },
    etfs: {
      label: 'ETFs',
      groupLabel: 'All themes',
      groups: etfData.themes,
      // A fund has assets, not a capitalisation, so the cap cutoff has no
      // meaning here and the setting hides itself.
      hasCap: false,
      asOf: etfData.asOf,
      items: etfData.funds.map((f) => ({
        symbol: f.symbol,
        name: f.name, // the theme label, not the fund's legal name
        k: themeIndex.get(f.theme) ?? 0,
        ...windows(f),
        c: f.corr,
        h: holdingsFor(f.symbol), // [symbol, weight %, stock index or -1]
      })),
    },
  },
};

const template = await readFile(new URL('ranks-template.html', import.meta.url), 'utf8');

// The selector lives in its own file so `npm run test:select` can exercise it in
// Node; the page needs the same source inline. Only the export line has to go.
const select = (await readFile(new URL('select.js', import.meta.url), 'utf8'))
  .replace(/^export \{[^}]*\};?[ \t]*$/m, '');
if (/^\s*export\b/m.test(select)) throw new Error('src/select.js still has an export after stripping');

// `</script` inside a string literal would close the host script element early.
const json = JSON.stringify(compact).replaceAll('</', '<\\/');
const html = template
  .replace('__SELECT__', () => select)
  .replace('__DATA__', () => json);
for (const marker of ['__SELECT__', '__DATA__']) {
  if (html.includes(marker)) throw new Error(`${marker} was not replaced`);
}

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/ranks.html', import.meta.url), html);

console.log(
  `dist/ranks.html — ${(html.length / 1024).toFixed(0)} KB · ` +
  `${compact.universes.stocks.items.length} stocks · ${compact.universes.etfs.items.length} funds · ` +
  `${mappedFunds} with holdings`,
);
