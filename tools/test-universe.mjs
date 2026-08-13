/**
 * Tests for the universe's eligibility and de-duplication rules.
 *
 * These are the two decisions that decide what the app is even about, so they
 * are checked against cases worked out by hand rather than by re-running the
 * pipeline. Nothing here touches the network.
 *
 *   node tools/test-universe.mjs
 */

import { classify, companyKey } from './universe.mjs';

let checks = 0;
const failures = [];

function check(ok, label) {
  checks += 1;
  if (!ok) failures.push(label);
}

function eq(actual, expected, label) {
  check(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
  );
}

function section(title) {
  console.log(title);
}

/** A screener row, with only the fields the rules read. */
const row = (symbol, country, exchangeShortName, companyName = symbol) => ({
  symbol,
  country,
  exchangeShortName,
  companyName,
});

/** A profile, with only the fields the rules read. */
const prof = (isAdr, country, cik = '') => ({ isAdr, country, cik });

section('domestic common stock stays eligible');
{
  for (const exchange of ['NYSE', 'NASDAQ', 'AMEX']) {
    eq(
      classify(row('AAPL', 'US', exchange), prof(false, 'US')),
      { isAdr: false, country: 'US' },
      `US common stock on ${exchange}`,
    );
  }
  // The floors, symbol shape and fund flags are applied before this point;
  // what classify owns is the security type and where it may be listed.
  eq(
    classify(row('XYZ', 'US', 'OTC'), prof(false, 'US')).skip,
    'listed on OTC',
    'US common stock over the counter is out',
  );
}

section('ADRs are eligible on the two main boards only');
{
  eq(
    classify(row('TSM', 'TW', 'NYSE'), prof(true, 'TW')),
    { isAdr: true, country: 'TW' },
    'ADR on NYSE',
  );
  eq(
    classify(row('ASML', 'NL', 'NASDAQ'), prof(true, 'NL')),
    { isAdr: true, country: 'NL' },
    'ADR on Nasdaq',
  );
  eq(
    classify(row('XXX', 'BR', 'AMEX'), prof(true, 'BR')).skip,
    'ADR listed on AMEX, not NYSE or Nasdaq',
    'ADR on NYSE American is out',
  );
  eq(
    classify(row('XXX', 'BR', 'OTC'), prof(true, 'BR')).skip,
    'ADR listed on OTC, not NYSE or Nasdaq',
    'OTC ADR is out',
  );
  // PDD's profile says Ireland, but it is a depositary receipt, and the
  // security type decides — not where the provider files the issuer.
  eq(
    classify(row('PDD', 'IE', 'NASDAQ'), prof(true, 'IE')),
    { isAdr: true, country: 'IE' },
    'a foreign-domiciled ADR is judged on being an ADR',
  );
}

section('a foreign listing that is not an ADR is not eligible');
{
  // Shopify, Linde and Accenture are foreign companies whose ordinary shares
  // list directly. Phase 10 admitted the ADR, not "anything on a US exchange".
  for (const [symbol, country] of [
    ['SHOP', 'CA'],
    ['LIN', 'GB'],
    ['ACN', 'IE'],
    ['MELI', 'UY'],
  ]) {
    eq(
      classify(row(symbol, country, 'NASDAQ'), prof(false, country)).skip,
      `${country} listing that is not an ADR`,
      `${symbol} is out`,
    );
  }
  eq(
    classify(row('XXX', undefined, 'NYSE'), prof(false, undefined)).skip,
    'foreign listing that is not an ADR',
    'an unknown domicile is not assumed to be American',
  );
}

section('one listing per company');
{
  const entry = (symbol, cik, companyName) => ({
    candidate: row(symbol, 'US', 'NASDAQ', companyName),
    profile: cik ? { cik } : {},
  });

  // Alphabet's two share classes are one economic exposure.
  const googl = companyKey(entry('GOOGL', '0001652044', 'Alphabet Inc.'));
  const goog = companyKey(entry('GOOG', '0001652044', 'Alphabet Inc.'));
  eq(googl.key, goog.key, 'GOOG and GOOGL share a key');
  eq(googl.byName, false, 'matched on CIK, not on the name');
  // Leading zeros are formatting, not identity.
  eq(
    companyKey(entry('X', '0000320193', 'Apple Inc.')).key,
    companyKey(entry('Y', '320193', 'Apple Inc.')).key,
    'a padded CIK is the same CIK',
  );
  check(
    companyKey(entry('AAPL', '0000320193', 'Apple Inc.')).key !==
      companyKey(entry('MSFT', '0000789019', 'Microsoft Corporation')).key,
    'two companies do not collide',
  );

  // Without a CIK the name decides, and says so, because it is the weaker test.
  const armAdr = companyKey(entry('ARM', '', 'Arm Holdings plc American Depositary Shares'));
  const armPlain = companyKey(entry('ARMX', '', 'Arm Holdings plc'));
  eq(armAdr.key, armPlain.key, 'the depositary wording is not part of the identity');
  eq(armAdr.byName, true, 'a name match reports itself as one');
  eq(
    companyKey(entry('A', '', 'CoreWeave, Inc. Class A Common Stock')).key,
    companyKey(entry('B', '', 'CoreWeave Inc')).key,
    'class and legal wording do not split one company in two',
  );
  check(
    companyKey(entry('A', '', 'Rocket Lab USA, Inc.')).key !==
      companyKey(entry('B', '', 'Rocket Pharmaceuticals, Inc.')).key,
    'similar names are still different companies',
  );
  // A nameless, CIK-less row must never merge with another one.
  check(
    companyKey(entry('AAA', '', '')).key !== companyKey(entry('BBB', '', '')).key,
    'nothing to match on means no match',
  );
}

console.log(`\n${checks} checks ${failures.length ? 'run' : 'passed'}`);
if (failures.length) {
  console.log(`\n${failures.length} FAILED:`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
