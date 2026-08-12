// Inlines data/ranks.json into src/ranks-template.html and writes
// dist/ranks.html.
//
//   node src/ranks-render.js

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const round = (v, dp) => (Number.isFinite(v) ? Number(v.toFixed(dp)) : null);

// FMP names carry share-class and legal-form boilerplate that eats the one line
// of width a phone gives the company name.
const NOISE = [
  /\s+(Class\s+[A-Z]\s+)?(Common\s+(Stock|Shares)|Ordinary\s+Shares)$/i,
  /,?\s+(Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.|Ltd\.?|Limited|plc|PLC|LLC|L\.P\.|LP|N\.V\.|S\.A\.|Holdings?|Group)$/,
];

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

function tidyName(name) {
  let out = name.trim();
  for (let pass = 0; pass < 3; pass++) {
    const before = out;
    for (const re of NOISE) out = out.replace(re, '').trim();
    if (out === before) break;
  }
  for (const [re, to] of SHORTEN) out = out.replace(re, to);
  // Stripping "Company" off "Wells Fargo & Company" leaves a dangling ampersand.
  return out.replace(/\s{2,}/g, ' ').replace(/[,\s]*(&|and)$/i, '').replace(/[,\s]+$/, '').trim() || name;
}

const data = JSON.parse(await readFile(new URL('../data/ranks.json', import.meta.url), 'utf8'));

// Sectors ship once as a list; each stock carries an index into it.
const sectors = data.sectors.map((s) => s.name);
const sectorIndex = new Map(sectors.map((name, i) => [name, i]));

// Sector abbreviations for the concentration flag; the label has to carry the
// meaning on its own at 10px.
const ABBR = {
  'Technology': 'TECH',
  'Communication Services': 'COMM',
  'Healthcare': 'HLTH',
  'Financial Services': 'FIN',
  'Energy': 'ENRG',
  'Consumer Cyclical': 'CYCL',
  'Consumer Defensive': 'DFNS',
  'Industrials': 'INDL',
  'Basic Materials': 'MATL',
  'Real Estate': 'RE',
  'Utilities': 'UTIL',
};

const compact = {
  asOf: data.asOf,
  sectors,
  abbr: sectors.map((name) => ABBR[name] ?? name.slice(0, 4).toUpperCase()),
  // Only what the page renders. `c` is the base64 correlation vector.
  stocks: data.stocks.map((s) => ({
    symbol: s.symbol,
    name: tidyName(s.name),
    k: sectorIndex.get(s.sector) ?? 0,
    m: Math.round(s.marketCap / 1e6), // $M; the page ranks on it for the cap filter
    // [blend, 12-1, 6-1] for each of score, return and volatility, so the
    // metric switch moves all three columns together.
    sc: [round(s.composite, 2), round(s.score12_1, 2), round(s.score6_1, 2)],
    rt: [round(s.annRet, 3), round(s.annRet12_1, 3), round(s.annRet6_1, 3)],
    vl: [round(s.annVol, 3), round(s.vol12, 3), round(s.vol6, 3)],
    c: s.corr,
  })),
};

const template = await readFile(new URL('ranks-template.html', import.meta.url), 'utf8');
// `</script` inside a string literal would close the host script element early.
const json = JSON.stringify(compact).replaceAll('</', '<\\/');
const html = template.replace('__DATA__', () => json);

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/ranks.html', import.meta.url), html);

console.log(`dist/ranks.html — ${(html.length / 1024).toFixed(0)} KB, ${compact.stocks.length} stocks`);
