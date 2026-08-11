// Render smoke test: mounts the real app and every screen against the real
// dataset, in both themes, and asserts that meaningful content reaches the tree.

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import App from '../../app/App.js';
import { ThemeProvider } from '../../app/src/theme.js';
import { AppStateProvider, useAppState } from '../../app/src/state.js';

import Overview from '../../app/src/screens/Overview.js';
import Rankings from '../../app/src/screens/Rankings.js';
import Sectors from '../../app/src/screens/Sectors.js';
import Portfolio from '../../app/src/screens/Portfolio.js';
import Ticker from '../../app/src/screens/Ticker.js';
import GroupDetail from '../../app/src/screens/GroupDetail.js';
import Compare from '../../app/src/screens/Compare.js';
import Search from '../../app/src/screens/Search.js';
import Methodology from '../../app/src/screens/Methodology.js';
import Settings from '../../app/src/screens/Settings.js';

import { universe, sectorSeries, industrySeries } from '../../app/src/data.js';

let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

const nav = { push: () => {}, pop: () => {}, switchTab: () => {}, canGoBack: true, depth: 1 };

// Collects every string rendered anywhere in the tree.
function allText(node) {
  const out = [];
  const walk = (n) => {
    if (n === null || n === undefined || n === false) return;
    if (typeof n === 'string' || typeof n === 'number') {
      out.push(String(n));
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(node);
  return out;
}

// Seeds a basket so the portfolio screens have something to analyse.
function Seed({ symbols, children }) {
  const app = useAppState();
  const done = React.useRef(false);
  React.useEffect(() => {
    if (done.current || !app.ready) return;
    done.current = true;
    symbols.forEach((s) => {
      if (!app.isSelected(s)) app.toggleSelected(s);
    });
  }, [app.ready]);
  return children;
}

async function mount(element) {
  let tree;
  await act(async () => {
    tree = TestRenderer.create(element);
  });
  // Let the persisted-state effects settle.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
}

// `minText` is per-screen: an error or empty state is supposed to be sparse,
// so holding it to a full screen's worth of content would be a false alarm.
async function renderScreen(name, Component, params = {}, seed = null, minText = 12) {
  const inner = React.createElement(Component, { nav, params });
  const body = seed
    ? React.createElement(Seed, { symbols: seed }, inner)
    : inner;
  const el = React.createElement(
    ThemeProvider,
    null,
    React.createElement(AppStateProvider, null, body)
  );
  const tree = await mount(el);
  const json = tree.toJSON();
  const texts = allText(json);
  ok(`${name} renders`, json !== null && texts.length >= minText, `${texts.length} strings, expected >= ${minText}`);
  return { tree, texts, json };
}

(async () => {
  console.log('\nfull app');
  const app = await mount(React.createElement(App));
  const appTexts = allText(app.toJSON());
  ok('App mounts', app.toJSON() !== null);
  ok('tab bar present', ['Overview', 'Rankings', 'Sectors', 'Basket'].every((l) => appTexts.includes(l)));
  ok('overview is the landing screen', appTexts.includes('Momentum Desk'));

  console.log('\nscreens');
  const ov = await renderScreen('Overview', Overview);
  ok('overview shows a macro asset', ov.texts.some((s) => s.includes('BITCOIN') || s.includes('US EQUITIES')));
  ok('overview shows leading sectors', ov.texts.includes('Leading sectors'.toUpperCase()));
  ok('overview names a real sector', ov.texts.some((s) => sectorSeries.some((x) => x.label === s)));
  ok('overview shows the trading date line', ov.texts.some((s) => s.includes('Rankings represent the close of')));

  const rk = await renderScreen('Rankings', Rankings);
  ok('rankings lists real tickers', rk.texts.filter((s) => universe.some((u) => u.symbol === s)).length > 5);
  ok('rankings shows measure switch', rk.texts.includes('12-1') && rk.texts.includes('Blend'));
  ok('rankings shows scope switch', rk.texts.includes('Global rank') && rk.texts.includes('Within sector'));

  const sc = await renderScreen('Sectors', Sectors);
  ok('sectors lists every sector', sectorSeries.every((s) => sc.texts.includes(s.label)));
  ok('sectors explains the method', sc.texts.some((s) => s.includes('equal weight')));

  const tk = await renderScreen('Ticker', Ticker, { symbol: 'AAPL' });
  ok('ticker shows the symbol', tk.texts.includes('AAPL'));
  ok('ticker shows all three measures', ['12-1 risk-adjusted momentum', '6-1 risk-adjusted momentum', 'Blended momentum']
    .every((l) => tk.texts.includes(l)));
  ok('ticker shows rank of', tk.texts.some((s) => /^\d+ of \d+$/.test(s)));
  ok('ticker shows the window', tk.texts.some((s) => s.includes('trading days ago') || s.includes('trading days')));
  ok('ticker shows ATR', tk.texts.includes('Typical daily swing'));

  const tkShort = await renderScreen('Ticker (lowest ranked name)', Ticker, {
    symbol: universe[universe.length - 1].symbol,
  });
  ok('any ticker renders', tkShort.texts.length > 20);

  const missing = await renderScreen('Ticker (unknown symbol)', Ticker, { symbol: 'NOTREAL' }, null, 3);
  ok('unknown ticker degrades gracefully', missing.texts.some((s) => s.includes('not in the current universe')));

  const gd = await renderScreen('GroupDetail sector', GroupDetail, { kind: 'sector', key: 'Technology' });
  ok('sector page lists members', gd.texts.filter((s) => universe.some((u) => u.symbol === s)).length > 5);
  ok('sector page shows industries inside', gd.texts.includes('INDUSTRIES INSIDE'));

  const gi = await renderScreen('GroupDetail industry', GroupDetail, {
    kind: 'industry',
    key: industrySeries[0].key,
  });
  ok('industry page renders its index', gi.texts.includes('EQUAL-WEIGHT INDEX'));

  // An industry too small to be ranked must explain itself rather than crash.
  const smallIndustry = (() => {
    const counts = new Map();
    for (const r of universe) if (r.industry) counts.set(r.industry, (counts.get(r.industry) || 0) + 1);
    for (const [k, v] of counts) if (v <= 2) return k;
    return null;
  })();
  if (smallIndustry) {
    const gu = await renderScreen('GroupDetail untagged industry', GroupDetail, {
      kind: 'industryList',
      key: smallIndustry,
    });
    ok('untagged industry explains itself', gu.texts.some((s) => s.includes('Not ranked as a group')));
  }

  const se = await renderScreen('Search', Search);
  ok('search offers sector jumps', se.texts.some((s) => sectorSeries.some((x) => x.label === s)));

  const me = await renderScreen('Methodology', Methodology);
  ok('methodology covers the universe rules', me.texts.some((s) => s.includes('Minimum daily turnover')));
  ok('methodology covers ranks', me.texts.some((s) => s.includes('Ranking method')));
  ok('methodology covers risk', me.texts.some((s) => s.includes('Rough day')));
  ok('methodology states the trading date', me.texts.some((s) => s.includes('Rankings represent')));

  const st = await renderScreen('Settings', Settings);
  ok('settings offers theme modes', ['System', 'Light', 'Dark'].every((l) => st.texts.includes(l)));

  console.log('\nempty states');
  const emptyPf = await renderScreen('Portfolio (empty)', Portfolio, {}, null, 5);
  ok('empty basket explains itself', emptyPf.texts.some((s) => s.includes('Your basket is empty')));
  const emptyCmp = await renderScreen('Compare (empty)', Compare, { symbols: [] }, null, 5);
  ok('empty compare explains itself', emptyCmp.texts.some((s) => s.includes('Nothing to compare')));

  console.log('\npopulated basket');
  const pf = await renderScreen('Portfolio (5 holdings)', Portfolio, {}, ['AAPL', 'MSFT', 'NVDA', 'XOM', 'JNJ']);
  ok('portfolio shows a normal-day figure', pf.texts.includes('NORMAL DAY'));
  ok('portfolio shows a dollar amount', pf.texts.some((s) => /^\$[\d,]+$/.test(s)));
  ok('portfolio explains in plain English', pf.texts.some((s) => s.includes('On a normal day this basket moves')));
  ok('portfolio shows independent positions', pf.texts.some((s) => s.includes('genuinely independent positions')));
  ok('portfolio shows weights', pf.texts.some((s) => /^\d+%$/.test(s)));
  ok('portfolio lists marginal impact', pf.texts.some((s) => s.startsWith('Without ')));
  ok('portfolio states its inputs', pf.texts.includes('Securities included'));
  ok('portfolio names the return window', pf.texts.some((s) => s.includes('trading days')));

  const cmp = await renderScreen('Compare (5 holdings)', Compare, { symbols: ['AAPL', 'MSFT', 'NVDA'] });
  ok('compare normalises', cmp.texts.includes('NORMALISED PERFORMANCE'));
  ok('compare lists each line', ['AAPL', 'MSFT', 'NVDA'].every((s) => cmp.texts.includes(s)));

  console.log('\nboth themes');
  for (const scheme of ['dark', 'light']) {
    const rn = await import('../../app/src/theme.js');
    // Theme resolution is driven by Appearance; the mock reports dark. Rendering
    // with an explicit mode proves the light palette is complete too.
    const el = React.createElement(
      ThemeProvider,
      null,
      React.createElement(AppStateProvider, null, React.createElement(ForceTheme, { mode: scheme },
        React.createElement(Overview, { nav, params: {} })))
    );
    const tree = await mount(el);
    ok(`${scheme} theme renders`, tree.toJSON() !== null && allText(tree.toJSON()).length > 10);
    void rn;
  }

  console.log(`\n${fail === 0 ? 'ALL RENDER CHECKS PASSED' : fail + ' RENDER CHECKS FAILED'}\n`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\nRender test threw:', err && err.stack ? err.stack : err);
  process.exit(1);
});

function ForceTheme({ mode, children }) {
  const { setMode } = require('../../app/src/theme.js').useTheme();
  const done = React.useRef(false);
  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    setMode(mode);
  }, []);
  return children;
}
