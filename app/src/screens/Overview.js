// Overview: the answer to "what should I look at first?"
//
// Order is deliberate - where the market is, which sectors lead, which stocks
// lead, and what your own basket is currently exposed to.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import Sparkline from '../components/Sparkline';
import Logo from '../components/Logo';
import { Card, SectionTitle, Pill, Divider, Button } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import {
  universe,
  sectorSeries,
  macro,
  manifest,
  returnsMapFor,
  atrPctMapFor,
  bySymbol,
} from '../data';
import { analysePortfolio, expectedMovement, describeRisk } from '../analytics/portfolio';
import { mediumDate, num, pctSigned, money0, relativeTime } from '../format';

export default function Overview({ nav }) {
  const { t } = useTheme();
  const app = useAppState();

  const topSectors = useMemo(
    () => sectorSeries.slice().sort((a, b) => (b.scores.blended ?? -99) - (a.scores.blended ?? -99)).slice(0, 4),
    []
  );

  const topStocks = useMemo(
    () =>
      universe
        .filter((r) => r.scores.blended !== null && !app.hidden.includes(r.symbol))
        .sort((a, b) => b.scores.blended - a.scores.blended)
        .slice(0, 5),
    [app.hidden]
  );

  const holdings = app.holdings();
  const risk = useMemo(() => {
    if (holdings.length === 0) return null;
    const syms = holdings.map((h) => h.symbol);
    const a = analysePortfolio(holdings, returnsMapFor(syms), atrPctMapFor(syms));
    if (!a || a.insufficientData) return { analysis: a, movement: null, description: null };
    const m = expectedMovement(a, app.portfolioValue);
    return { analysis: a, movement: m, description: describeRisk(a, m) };
  }, [JSON.stringify(holdings), app.portfolioValue]);

  return (
    <View style={{ flex: 1 }}>
      <Header
        large
        title="Momentum Desk"
        subtitle={`${manifest.counts.universe} stocks · ${manifest.counts.sectors} sectors · ranked on ${mediumDate(manifest.tradingDate)}`}
        nav={nav}
        action="Search"
        onAction={() => nav.push('search')}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* ---------------------------------------------------------- macro */}
        <SectionTitle>Market backdrop</SectionTitle>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {macro.map((m) => {
            const tone = toneFor(t, m.return1m);
            return (
              <Card key={m.key} style={[styles.macroCard, { borderColor: t.border }]} padded={false}>
                <View style={{ padding: 12 }}>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro, fontWeight: '600' }}>
                    {m.label.toUpperCase()}
                  </Text>
                  <Text style={{ color: t.text, fontSize: 19, fontWeight: '700', fontFamily: t.mono, marginTop: 4 }}>
                    {m.last >= 1000 ? Math.round(m.last).toLocaleString('en-US') : num(m.last, 2)}
                  </Text>
                  <View style={{ height: 26, marginTop: 6, marginBottom: 4 }}>
                    <Sparkline
                      values={m.values.slice(-120)}
                      color={tone}
                      width={96}
                      height={26}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: tone, fontSize: t.font.label, fontWeight: '700', fontFamily: t.mono }}>
                      {pctSigned(m.return1m)}
                    </Text>
                    <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginLeft: 5 }}>1M</Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>

        {/* -------------------------------------------------------- sectors */}
        <SectionTitle action="All sectors" onAction={() => nav.switchTab('sectors')}>
          Leading sectors
        </SectionTitle>
        <Card style={styles.card} padded={false}>
          {topSectors.map((s, i) => (
            <View key={s.key}>
              {i > 0 ? <Divider inset={16} /> : null}
              <Pressable
                onPress={() => nav.push('group', { kind: 'sector', key: s.key })}
                style={({ pressed }) => [styles.sectorRow, { backgroundColor: pressed ? t.surface : 'transparent' }]}
              >
                <Text style={{ color: t.textFaint, fontFamily: t.mono, fontSize: 13, width: 22 }}>
                  {s.ranks.blended.rank}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro, marginTop: 2 }}>
                    {s.constituents} names, equal weight
                  </Text>
                </View>
                <Sparkline values={s.values.slice(-120)} color={toneFor(t, s.return3m)} width={54} height={22} />
                <View style={{ alignItems: 'flex-end', marginLeft: 10, minWidth: 62 }}>
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', fontFamily: t.mono }}>
                    {num(s.scores.blended, 2)}
                  </Text>
                  <Text style={{ color: toneFor(t, s.return3m), fontSize: t.font.micro, fontFamily: t.mono, marginTop: 2 }}>
                    {pctSigned(s.return3m)} 3M
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </Card>

        {/* --------------------------------------------------------- stocks */}
        <SectionTitle action="All stocks" onAction={() => nav.switchTab('rankings')}>
          Leading stocks
        </SectionTitle>
        <Card style={styles.card} padded={false}>
          {topStocks.map((r, i) => (
            <View key={r.symbol}>
              {i > 0 ? <Divider inset={16} /> : null}
              <Pressable
                onPress={() => nav.push('ticker', { symbol: r.symbol })}
                style={({ pressed }) => [styles.stockRow, { backgroundColor: pressed ? t.surface : 'transparent' }]}
              >
                <Text style={{ color: t.textFaint, fontFamily: t.mono, fontSize: 13, width: 22 }}>{i + 1}</Text>
                <Logo symbol={r.symbol} uri={r.logo} size={34} />
                <View style={{ flex: 1, marginLeft: 11 }}>
                  <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>{r.symbol}</Text>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro, marginTop: 2 }} numberOfLines={1}>
                    {r.sector}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', fontFamily: t.mono }}>
                    {num(r.scores.blended, 2)}
                  </Text>
                  <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }}>
                    #{r.ranks.blended.group} in sector
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </Card>

        {/* ------------------------------------------------------ your risk */}
        <SectionTitle action={holdings.length ? 'Open basket' : undefined} onAction={() => nav.switchTab('portfolio')}>
          Your basket
        </SectionTitle>
        <Card style={styles.card}>
          {holdings.length === 0 ? (
            <View>
              <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '600' }}>
                Nothing selected yet
              </Text>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, marginTop: 6, lineHeight: 20 }}>
                Pick a few stocks from the rankings and this card will tell you, in plain terms, how much
                the basket is likely to move on a normal day.
              </Text>
              <Button
                label="Browse rankings"
                onPress={() => nav.switchTab('rankings')}
                style={{ marginTop: 14 }}
              />
            </View>
          ) : risk && risk.description ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Pill label={risk.description.band.label} tone={risk.description.band.tone === 'high' ? 'down' : risk.description.band.tone === 'mid' ? 'warn' : 'up'} />
                <View style={{ width: 8 }} />
                <Pill label={risk.description.diversification.label} tone="neutral" />
              </View>
              <Text style={{ color: t.text, fontSize: 17, lineHeight: 25 }}>
                {risk.description.sentences[0]}
              </Text>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, lineHeight: 21, marginTop: 8 }}>
                {risk.description.sentences[1]}
              </Text>
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <Metric label="Holdings" value={String(holdings.length)} />
                <Metric label="Typical day" value={money0(risk.movement.typicalDayValue)} />
                <Metric label="Rough day" value={money0(risk.movement.roughDayValue)} tone={t.down} />
              </View>
            </View>
          ) : (
            <Text style={{ color: t.textMuted, fontSize: t.font.body }}>
              {risk && risk.analysis ? risk.analysis.reason : 'Not enough overlapping history yet.'}
            </Text>
          )}
        </Card>

        {/* ----------------------------------------------------- freshness */}
        <View style={styles.footer}>
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, lineHeight: 17 }}>
            Rankings represent the close of {mediumDate(manifest.tradingDate)}.{'\n'}
            Dataset built {relativeTime(manifest.builtAt)} from {manifest.provider}.
          </Text>
          <Pressable onPress={() => nav.push('methodology')} style={{ marginTop: 10 }}>
            <Text style={{ color: t.accent, fontSize: t.font.label, fontWeight: '600' }}>
              How these numbers are calculated ›
            </Text>
          </Pressable>
          <Pressable onPress={() => nav.push('settings')} style={{ marginTop: 8 }}>
            <Text style={{ color: t.accent, fontSize: t.font.label, fontWeight: '600' }}>
              Appearance and saved data ›
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, tone }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.textFaint, fontSize: t.font.micro }}>{label}</Text>
      <Text style={{ color: tone || t.text, fontSize: 17, fontWeight: '700', fontFamily: t.mono, marginTop: 3 }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16 },
  macroCard: { width: 132, marginRight: 10 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  stockRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16 },
  footer: { paddingHorizontal: 16, marginTop: 26 },
});
