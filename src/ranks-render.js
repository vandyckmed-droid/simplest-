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
  /,?\s+(Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.|Ltd\.?|Limited|plc|PLC|LLC|L\.P\.|N\.V\.|S\.A\.)$/,
];

function tidyName(name) {
  let out = name.trim();
  for (let pass = 0; pass < 3; pass++) {
    const before = out;
    for (const re of NOISE) out = out.replace(re, '').trim();
    if (out === before) break;
  }
  // Stripping "Company" off "Wells Fargo & Company" leaves a dangling ampersand.
  return out.replace(/[,\s]*(&|and)$/i, '').replace(/[,\s]+$/, '').trim() || name;
}

const data = JSON.parse(await readFile(new URL('../data/ranks.json', import.meta.url), 'utf8'));

// Sectors ship once as a list; each stock carries an index into it.
const sectors = data.sectors.map((s) => s.name);
const sectorIndex = new Map(sectors.map((name, i) => [name, i]));

const compact = {
  asOf: data.asOf,
  sectors,
  // Only what the page renders. `c` is the base64 correlation vector.
  stocks: data.stocks.map((s) => ({
    symbol: s.symbol,
    name: tidyName(s.name),
    k: sectorIndex.get(s.sector) ?? 0,
    composite: round(s.composite, 2),
    annRet: round(s.annRet, 3),
    annVol: round(s.annVol, 3),
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
