// Inlines data/screener.json into src/template.html and writes dist/index.html,
// the self-contained page published as the artifact.
//
//   node src/render.js

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
  return out.replace(/[,\s]+$/, '') || name;
}

const data = JSON.parse(await readFile(new URL('../data/screener.json', import.meta.url), 'utf8'));

// Trim the payload to what the page actually renders, at display precision.
const compact = {
  generatedAt: data.generatedAt,
  asOf: data.asOf,
  groups: data.groups,
  stocks: data.stocks.map((s) => ({
    symbol: s.symbol,
    name: tidyName(s.name),
    group: s.group,
    industry: s.industry,
    sector: s.sector,
    ret12_1: round(s.ret12_1, 4),
    ret6_1: round(s.ret6_1, 4),
    annRet12_1: round(s.annRet12_1, 4),
    annRet6_1: round(s.annRet6_1, 4),
    vol12: round(s.vol12, 4),
    vol6: round(s.vol6, 4),
    score12_1: round(s.score12_1, 3),
    score6_1: round(s.score6_1, 3),
    composite: round(s.composite, 3),
    rank: s.rank,
    groupRank: s.groupRank,
    groupSize: s.groupSize,
  })),
};

const template = await readFile(new URL('template.html', import.meta.url), 'utf8');
// `</script` inside a string literal would close the host script element early.
const json = JSON.stringify(compact).replaceAll('</', '<\\/');
const html = template.replace('__DATA__', () => json);

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/index.html', import.meta.url), html);

console.log(`dist/index.html — ${(html.length / 1024).toFixed(0)} KB, ${compact.stocks.length} stocks`);
