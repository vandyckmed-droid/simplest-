// Generates a Snack URL that loads every app file straight from GitHub raw.
//
// Snack's "Import git repository" button needs the Expo project at the
// repository ROOT, and this repo deliberately keeps it in app/ (the 21 MB of
// price history alongside it would choke the importer). The documented `files`
// query parameter sidesteps the importer entirely: each file is declared as
// CODE loaded from a URL.
//
// Run: node pipeline/scripts/make-snack-url.mjs [--ref <git-ref>] [--verify]

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const refArg = args.indexOf('--ref');
const REF = refArg >= 0 ? args[refArg + 1] : 'main';
const VERIFY = args.includes('--verify');

const OWNER = 'vandyckmed-droid';
const REPO = 'simplest-';
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${REF}`;

// Everything the app needs, mapped from its repo path to its path inside the
// Snack. package.json and app.json are omitted on purpose: Snack resolves
// dependencies from the `dependencies` query parameter instead.
const APP_DIR = path.resolve('app');
function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(p, out);
    else out.push(p);
  }
  return out;
}

const SKIP = new Set(['app/package.json', 'app/app.json']);

const files = {};
for (const abs of collect(APP_DIR).sort()) {
  const repoPath = path.relative(process.cwd(), abs).split(path.sep).join('/');
  if (SKIP.has(repoPath)) continue;
  if (!/\.(js|json)$/.test(repoPath)) continue;
  // app/src/theme.js -> src/theme.js
  const snackPath = repoPath.replace(/^app\//, '');
  files[snackPath] = { type: 'CODE', url: `${RAW}/${repoPath}` };
}

// expo-status-bar and react are provided by the Snack runtime.
const dependencies = ['react-native-svg', '@react-native-async-storage/async-storage'].join(',');

const params = new URLSearchParams({
  name: 'Momentum Desk',
  description: 'Momentum rankings, sector series and portfolio risk',
  dependencies,
  platform: 'mydevice',
  supportedPlatforms: 'ios,android',
  files: JSON.stringify(files),
});

const url = `https://snack.expo.dev/?${params.toString()}`;

console.log(`ref:        ${REF}`);
console.log(`files:      ${Object.keys(files).length}`);
console.log(`url length: ${url.length}`);
console.log('');

if (VERIFY) {
  console.log('verifying every source URL resolves...');
  let bad = 0;
  let totalBytes = 0;
  for (const [snackPath, def] of Object.entries(files)) {
    try {
      const res = await fetch(def.url, { signal: AbortSignal.timeout(30000) });
      const body = await res.text();
      totalBytes += body.length;
      const flag = res.ok && body.length > 0 ? 'ok  ' : 'FAIL';
      if (!res.ok || body.length === 0) bad += 1;
      console.log(`  ${flag} ${String(res.status)} ${String(body.length).padStart(8)}  ${snackPath}`);
    } catch (e) {
      bad += 1;
      console.log(`  FAIL ERR ${' '.repeat(8)}  ${snackPath}  ${e.message}`);
    }
  }
  console.log('');
  console.log(`total payload: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  if (bad > 0) {
    console.error(`\n${bad} file(s) did not resolve — the Snack link would be broken. Not printing it.`);
    process.exit(1);
  }
  console.log('all files resolve\n');
}

console.log(url);
