// The basket: weights in, plain-language risk out.
//
// The guiding idea is that "annualised volatility 24.3%" tells most people
// nothing, while "about $180 on a normal day, $300 on a rough one" tells them
// exactly what they need. The statistics are still here - they are just not the
// headline.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import Logo from '../components/Logo';
import { Card, SectionTitle, Divider, StatRow, Button, EmptyState, Pill, Inputs, Segmented } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import { bySymbol, returnsMapFor, atrPctMapFor, manifest } from '../data';
import {
  analysePortfolio,
  expectedMovement,
  describeRisk,
  findRedundant,
  normaliseWeights,
} from '../analytics/portfolio';
import { compactMoney, money0, num, pct, pctSigned } from '../format';

const VALUES = [1000, 5000, 10000, 25000, 100000];

export default function Portfolio({ nav }) {
  const { t } = useTheme();
  const app = useAppState();
  const [showMatrix, setShowMatrix] = useState(false);

  const holdings = app.holdings();
  const symbols = holdings.map((h) => h.symbol);

  const analysis = useMemo(() => {
    if (holdings.length === 0) return null;
    return analysePortfolio(holdings, returnsMapFor(symbols), atrPctMapFor(symbols));
  }, [JSON.stringify(holdings)]);

  const movement = useMemo(
    () => (analysis && !analysis.insufficientData ? expectedMovement(analysis, app.portfolioValue) : null),
    [analysis, app.portfolioValue]
  );
  const description = useMemo(
    () => (analysis && movement ? describeRisk(analysis, movement) : null),
    [analysis, movement]
  );
  const redundant = useMemo(() => (analysis ? findRedundant(analysis, 0.7) : []), [analysis]);

  const normalised = useMemo(
    () => normaliseWeights(holdings.reduce((a, h) => ({ ...a, [h.symbol]: h.weight }), {})),
    [JSON.stringify(holdings)]
  );

  if (holdings.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <Header large title="Basket" subtitle="Select stocks to size them and see what they do together" nav={nav} />
        <EmptyState
          title="Your basket is empty"
          body="Add a few names from the rankings or search. You will get a plain-language read on how much the basket moves, and whether your picks are really different bets."
          action="Browse rankings"
          onAction={() => nav.switchTab('rankings')}
        />
      </View>
    );
  }

  const step = (symbol, delta) => {
    // Editing one weight pins every weight in the same update. Otherwise the
    // untouched holdings would be re-derived as "equal share of the remainder"
    // on the next render and the number under your finger would not stick.
    const next = {};
    for (const s of symbols) {
      const current = normalised[s] * 100;
      next[s] = s === symbol
        ? Math.max(0, Math.min(100, Math.round(current + delta)))
        : Math.round(current * 10) / 10;
    }
    app.setWeights(next);
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        large
        title="Basket"
        subtitle={`${holdings.length} holding${holdings.length === 1 ? '' : 's'} · ${money0(app.portfolioValue)} assumed`}
        nav={nav}
        action="Compare"
        onAction={() => nav.push('compare', { symbols: symbols.slice(0, 6) })}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        {/* --------------------------------------------- expected movement */}
        <SectionTitle>What this is likely to do</SectionTitle>
        <Card style={styles.card}>
          {analysis && analysis.insufficientData ? (
            <Text style={{ color: t.warn, fontSize: t.font.body, lineHeight: 22 }}>{analysis.reason}</Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                <Pill
                  label={description.band.label}
                  tone={description.band.tone === 'high' ? 'down' : description.band.tone === 'mid' ? 'warn' : 'up'}
                />
                <View style={{ width: 8 }} />
                <Pill label={description.diversification.label} tone="neutral" />
              </View>

              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro }}>NORMAL DAY</Text>
                  <Text style={{ color: t.text, fontSize: 30, fontWeight: '700', fontFamily: t.mono, letterSpacing: -0.6 }}>
                    {money0(movement.typicalDayValue)}
                  </Text>
                  <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }}>
                    {pct(movement.typicalDayPct)} either way
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro }}>ROUGH DAY</Text>
                  <Text style={{ color: t.down, fontSize: 30, fontWeight: '700', fontFamily: t.mono, letterSpacing: -0.6 }}>
                    {money0(movement.roughDayValue)}
                  </Text>
                  <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }}>
                    about 1 day in 20
                  </Text>
                </View>
              </View>

              <View style={{ height: 16 }} />
              {description.sentences.map((s, i) => (
                <Text
                  key={i}
                  style={{
                    color: i === 0 ? t.text : t.textMuted,
                    fontSize: i === 0 ? t.font.body : t.font.label,
                    lineHeight: i === 0 ? 24 : 21,
                    marginBottom: 8,
                  }}
                >
                  {s}
                </Text>
              ))}
            </>
          )}
        </Card>

        {/* -------------------------------------------------- assumed value */}
        <SectionTitle>Amount invested</SectionTitle>
        <View style={{ paddingHorizontal: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {VALUES.map((v) => (
              <Pressable
                key={v}
                onPress={() => app.setPortfolioValue(v)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: t.radius.pill,
                  marginRight: 8,
                  backgroundColor: app.portfolioValue === v ? t.accent : t.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: app.portfolioValue === v ? t.accent : t.border,
                }}
              >
                <Text
                  style={{
                    color: app.portfolioValue === v ? '#FFFFFF' : t.textMuted,
                    fontWeight: '700',
                    fontSize: t.font.label,
                  }}
                >
                  {money0(v)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* -------------------------------------------------------- holdings */}
        <SectionTitle action="Equalise" onAction={app.resetWeights}>
          Holdings and weights
        </SectionTitle>
        <Card style={styles.card} padded={false}>
          {symbols.map((sym, i) => {
            const row = bySymbol.get(sym);
            const w = normalised[sym] * 100;
            const red = redundant.find((r) => r.symbol === sym);
            const marg = analysis && !analysis.insufficientData ? analysis.marginal.find((m) => m.symbol === sym) : null;
            return (
              <View key={sym}>
                {i > 0 ? <Divider inset={16} /> : null}
                <View style={styles.holdingRow}>
                  <Pressable onPress={() => nav.push('ticker', { symbol: sym })} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Logo symbol={sym} uri={row ? row.logo : null} size={34} />
                    <View style={{ marginLeft: 11, flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 15, fontWeight: '700' }}>{sym}</Text>
                      <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }} numberOfLines={1}>
                        {row ? row.sector : ''}
                        {marg && marg.delta !== null
                          ? ` · drop it: ${marg.delta > 0 ? '+' : ''}${(marg.delta * 100).toFixed(1)}% vol`
                          : ''}
                      </Text>
                    </View>
                  </Pressable>

                  <View style={styles.weightControls}>
                    <Pressable onPress={() => step(sym, -5)} hitSlop={8} style={[styles.stepBtn, { borderColor: t.border }]}>
                      <Text style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>−</Text>
                    </Pressable>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', fontFamily: t.mono, width: 46, textAlign: 'center' }}>
                      {w.toFixed(0)}%
                    </Text>
                    <Pressable onPress={() => step(sym, 5)} hitSlop={8} style={[styles.stepBtn, { borderColor: t.border }]}>
                      <Text style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>+</Text>
                    </Pressable>
                  </View>

                  <Pressable onPress={() => app.toggleSelected(sym)} hitSlop={10} style={{ marginLeft: 10 }}>
                    <Text style={{ color: t.textFaint, fontSize: 17 }}>×</Text>
                  </Pressable>
                </View>

                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  <View style={{ height: 4, backgroundColor: t.surfaceAlt, borderRadius: 2 }}>
                    <View
                      style={{
                        height: 4,
                        width: `${Math.min(100, w)}%`,
                        backgroundColor: red ? t.warn : t.accent,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  {red ? (
                    <Text style={{ color: t.warn, fontSize: t.font.micro, marginTop: 6 }}>
                      Tracks the rest of the basket very closely (correlation{' '}
                      {red.avgCorrelation.toFixed(2)}) — adds little that your other holdings do not
                      already give you.
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Card>

        <View style={{ paddingHorizontal: 16, marginTop: 12, flexDirection: 'row' }}>
          <Button label="Add more" tone="ghost" onPress={() => nav.push('search')} style={{ flex: 1, marginRight: 10 }} />
          <Button label="Clear basket" tone="ghost" onPress={app.clearSelected} style={{ flex: 1 }} />
        </View>

        {/* -------------------------------------------------- diversification */}
        {analysis && !analysis.insufficientData ? (
          <>
            <SectionTitle>Are these different bets?</SectionTitle>
            <Card style={styles.card}>
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ color: t.text, fontSize: 42, fontWeight: '700', fontFamily: t.mono, letterSpacing: -1 }}>
                  {analysis.effectiveBets.toFixed(1)}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: t.font.label, marginTop: 2 }}>
                  genuinely independent positions
                </Text>
                <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 6, textAlign: 'center', lineHeight: 17 }}>
                  You hold {holdings.length}. The gap is how much your names overlap.
                </Text>
              </View>

              <DiversificationBar value={analysis.effectiveBets} max={holdings.length} />

              <View style={{ height: 8 }} />
              <Divider />
              <StatRow
                label="Average pairing"
                value={analysis.avgPairCorrelation !== null ? analysis.avgPairCorrelation.toFixed(2) : '—'}
                hint="1.00 means they move as one; 0.00 means unrelated"
              />
              <Divider />
              <StatRow
                label="Risk reduction from mixing"
                value={`${((1 - 1 / analysis.diversificationRatio) * 100).toFixed(0)}%`}
                hint={`Holding them together is ${((1 - 1 / analysis.diversificationRatio) * 100).toFixed(0)}% calmer than the weighted average of the parts`}
              />
              <Divider />
              <StatRow
                label="Basket volatility, annual"
                value={pct(analysis.annualVol)}
                hint={`Weighted average of the parts is ${pct(analysis.weightedAvgVol)}`}
              />
            </Card>

            {redundant.length > 0 ? (
              <>
                <SectionTitle>Overlapping holdings</SectionTitle>
                <Card style={styles.card}>
                  <Text style={{ color: t.textMuted, fontSize: t.font.label, lineHeight: 21, marginBottom: 12 }}>
                    These names track the rest of your basket closely. Trimming one of a pair usually costs
                    little and frees room for something different.
                  </Text>
                  {redundant.map((r, i) => (
                    <View key={r.symbol}>
                      {i > 0 ? <Divider /> : null}
                      <StatRow
                        label={r.symbol}
                        value={`corr ${r.avgCorrelation.toFixed(2)}`}
                        tone={t.warn}
                        hint={`${(r.weight * 100).toFixed(0)}% of the basket`}
                        onPress={() => nav.push('ticker', { symbol: r.symbol })}
                      />
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {/* ------------------------------------------ marginal impact */}
            <SectionTitle>What each holding does to the risk</SectionTitle>
            <Card style={styles.card}>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, lineHeight: 21, marginBottom: 10 }}>
                If you removed a name and spread its weight across the others, the basket&apos;s annual
                movement would change like this.
              </Text>
              {analysis.marginal
                .slice()
                .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
                .map((m, i) => (
                  <View key={m.symbol}>
                    {i > 0 ? <Divider /> : null}
                    <StatRow
                      label={`Without ${m.symbol}`}
                      value={m.delta === null ? '—' : `${m.delta > 0 ? '+' : ''}${(m.delta * 100).toFixed(1)}%`}
                      tone={m.delta === null ? t.textMuted : m.delta > 0 ? t.down : t.up}
                      hint={m.volWithout !== null ? `Basket would sit at ${pct(m.volWithout)} annual` : undefined}
                    />
                  </View>
                ))}
              <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 17 }}>
                A negative number means dropping that holding would calm the basket down; a positive one
                means it is currently helping to smooth things out.
              </Text>
            </Card>

            {/* ------------------------------------------------ correlations */}
            {holdings.length > 1 ? (
              <>
                <SectionTitle
                  action={showMatrix ? 'Hide grid' : 'Show grid'}
                  onAction={() => setShowMatrix(!showMatrix)}
                >
                  Closest pairs
                </SectionTitle>
                <Card style={styles.card} padded={!showMatrix}>
                  {showMatrix ? (
                    <CorrelationGrid symbols={symbols} matrix={analysis.correlation} />
                  ) : (
                    <ClosestPairs symbols={symbols} matrix={analysis.correlation} nav={nav} />
                  )}
                </Card>
              </>
            ) : null}

            {/* ----------------------------------------------------- inputs */}
            <SectionTitle>Inputs behind these numbers</SectionTitle>
            <Card style={styles.card}>
              <StatRow label="Securities included" value={String(analysis.symbols.length)} />
              <Divider />
              <StatRow
                label="Return window"
                value={`${analysis.overlap} trading days`}
                hint="Days where every holding traded; the longest common run up to 252"
              />
              <Divider />
              <StatRow label="Volatility basis" value="daily returns × √252" mono={false} />
              <Divider />
              <StatRow
                label="Weights"
                value={symbols.map((s) => `${(normalised[s] * 100).toFixed(0)}%`).join(' · ')}
                mono={false}
              />
              <Divider />
              <StatRow
                label="Typical daily swing by ATR"
                value={analysis.weightedAtrPct !== null ? pct(analysis.weightedAtrPct, 2) : '—'}
                hint="Weighted 14-day average true range"
              />
              <Divider />
              <StatRow label="Prices through" value={manifest.tradingDate} />
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DiversificationBar({ value, max }) {
  const { t } = useTheme();
  const frac = max > 1 ? (value - 1) / (max - 1) : 0;
  const tone = frac > 0.6 ? t.up : frac > 0.3 ? t.warn : t.down;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ height: 8, backgroundColor: t.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ height: 8, width: `${Math.max(3, Math.min(100, frac * 100))}%`, backgroundColor: tone }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: t.textFaint, fontSize: t.font.micro }}>one bet repeated</Text>
        <Text style={{ color: t.textFaint, fontSize: t.font.micro }}>{max} separate bets</Text>
      </View>
    </View>
  );
}

function ClosestPairs({ symbols, matrix, nav }) {
  const { t } = useTheme();
  const pairs = [];
  for (let i = 0; i < symbols.length; i += 1) {
    for (let j = i + 1; j < symbols.length; j += 1) {
      const c = matrix[i][j];
      if (typeof c === 'number') pairs.push({ a: symbols[i], b: symbols[j], c });
    }
  }
  pairs.sort((x, y) => y.c - x.c);
  const top = pairs.slice(0, 6);

  if (top.length === 0) {
    return <Text style={{ color: t.textMuted, fontSize: t.font.label }}>Not enough overlap to compare.</Text>;
  }

  return (
    <View>
      {top.map((p, i) => (
        <View key={`${p.a}-${p.b}`}>
          {i > 0 ? <Divider /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11 }}>
            <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '600', flex: 1 }}>
              {p.a} <Text style={{ color: t.textFaint }}>and</Text> {p.b}
            </Text>
            <View style={{ width: 70, height: 6, backgroundColor: t.surfaceAlt, borderRadius: 3, marginRight: 10 }}>
              <View
                style={{
                  height: 6,
                  width: `${Math.max(2, Math.min(100, ((p.c + 1) / 2) * 100))}%`,
                  backgroundColor: p.c > 0.7 ? t.warn : p.c > 0.3 ? t.accent : t.up,
                  borderRadius: 3,
                }}
              />
            </View>
            <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '700', fontFamily: t.mono, width: 46, textAlign: 'right' }}>
              {p.c.toFixed(2)}
            </Text>
          </View>
        </View>
      ))}
      <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 8, lineHeight: 17 }}>
        1.00 means the two moved in lockstep over the past year. Below about 0.30 they are largely doing
        their own thing.
      </Text>
    </View>
  );
}

function CorrelationGrid({ symbols, matrix }) {
  const { t } = useTheme();
  const cell = 40;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 52 }} />
          {symbols.map((s) => (
            <Text
              key={s}
              style={{ width: cell, color: t.textFaint, fontSize: 9, textAlign: 'center' }}
              numberOfLines={1}
            >
              {s}
            </Text>
          ))}
        </View>
        {symbols.map((s, i) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Text style={{ width: 52, color: t.textMuted, fontSize: 10, fontWeight: '600' }} numberOfLines={1}>
              {s}
            </Text>
            {symbols.map((s2, j) => {
              const c = matrix[i][j];
              const v = typeof c === 'number' ? c : 0;
              const intensity = Math.max(0, Math.min(1, (v + 1) / 2));
              return (
                <View
                  key={s2}
                  style={{
                    width: cell - 2,
                    height: cell - 12,
                    marginRight: 2,
                    borderRadius: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      i === j
                        ? t.surfaceAlt
                        : t.name === 'dark'
                        ? `rgba(91, 141, 239, ${intensity * 0.75})`
                        : `rgba(37, 99, 235, ${intensity * 0.6})`,
                  }}
                >
                  <Text style={{ color: i === j ? t.textFaint : t.text, fontSize: 9, fontWeight: '600' }}>
                    {typeof c === 'number' ? c.toFixed(1) : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  weightControls: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
