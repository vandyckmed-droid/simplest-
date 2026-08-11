// Sectors and industries, ranked with the same framework as individual stocks.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import Chart from '../components/Chart';
import Sparkline from '../components/Sparkline';
import { Card, SectionTitle, Segmented, Divider, Inputs, Pill } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import { sectorSeries, industrySeries, dates, manifest } from '../data';
import { rebase } from '../analytics/returns';
import { num, pctSigned, zLabel, mediumDate } from '../format';

const MEASURES = [
  { label: '12-1', value: 'score12' },
  { label: '6-1', value: 'score6' },
  { label: 'Blend', value: 'blended' },
];

const RANGES = [
  { label: '3M', value: 63 },
  { label: '6M', value: 126 },
  { label: '1Y', value: 252 },
  { label: '2Y', value: 520 },
];

export default function Sectors({ nav }) {
  const { t } = useTheme();
  const app = useAppState();
  const [tab, setTab] = useState('sector');
  const [measure, setMeasure] = useState('blended');
  const [range, setRange] = useState(252);

  const list = tab === 'sector' ? sectorSeries : industrySeries;

  const ranked = useMemo(
    () => list.slice().sort((a, b) => (b.scores[measure] ?? -99) - (a.scores[measure] ?? -99)),
    [list, measure]
  );

  // The chart shows the leaders and the laggard together, which is the
  // comparison people actually want from a sector screen.
  const chartSeries = useMemo(() => {
    const picks = [ranked[0], ranked[1], ranked[ranked.length - 1]].filter(Boolean);
    const colors = [t.up, t.accent, t.down];
    return picks.map((s, i) => ({
      label: s.label,
      values: rebase(s.values.slice(-range)),
      color: colors[i],
      width: 2,
    }));
  }, [ranked, range, t]);

  const chartDates = dates.slice(-range);

  return (
    <View style={{ flex: 1 }}>
      <Header
        large
        title={tab === 'sector' ? 'Sectors' : 'Industries'}
        subtitle={
          tab === 'sector'
            ? `${sectorSeries.length} equal-weight sector series built from the ${manifest.counts.universe}-stock universe`
            : `${industrySeries.length} industries with at least ${manifest.config.industries.minCountToTag} names`
        }
        nav={nav}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Segmented
            options={[
              { label: 'Sectors', value: 'sector' },
              { label: 'Industries', value: 'industry' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <View style={{ height: 8 }} />
          <Segmented options={MEASURES} value={measure} onChange={setMeasure} />
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Card padded={false}>
            <View style={{ padding: 14, paddingBottom: 2 }}>
              <Text style={{ color: t.textMuted, fontSize: t.font.micro, fontWeight: '600', letterSpacing: 0.5 }}>
                LEADERS AND LAGGARD
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {chartSeries.map((s) => (
                  <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color, marginRight: 5 }} />
                    <Text style={{ color: t.textMuted, fontSize: t.font.micro }} numberOfLines={1}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ paddingHorizontal: 10 }}>
              <Chart series={chartSeries} dates={chartDates} height={180} baseline={100} fill={false} yFormat={(v) => v.toFixed(0)} />
            </View>
            <View style={{ padding: 14, paddingTop: 8 }}>
              <Segmented options={RANGES} value={range} onChange={setRange} />
              <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 16 }}>
                Each line starts at 100 on {chartDates[0]}. Series are equal weight and rebalanced daily.
              </Text>
            </View>
          </Card>
        </View>

        <SectionTitle>Ranked by {MEASURES.find((m) => m.value === measure).label} score</SectionTitle>
        <Card style={{ marginHorizontal: 16 }} padded={false}>
          {ranked.map((s, i) => (
            <View key={s.key}>
              {i > 0 ? <Divider inset={16} /> : null}
              <Pressable
                onPress={() => nav.push('group', { kind: tab, key: s.key })}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? t.surface : 'transparent' }]}
              >
                <Text style={{ color: t.textFaint, fontFamily: t.mono, fontSize: 13, width: 24 }}>{i + 1}</Text>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                    {s.label}
                  </Text>
                  <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }}>
                    {s.constituents} names · z {zLabel(s.ranks[measure].z)}
                  </Text>
                </View>
                <Sparkline values={s.values.slice(-120)} color={toneFor(t, s.return3m)} width={50} height={22} />
                <View style={{ alignItems: 'flex-end', marginLeft: 10, minWidth: 60 }}>
                  <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', fontFamily: t.mono }}>
                    {num(s.scores[measure], 2)}
                  </Text>
                  <Text style={{ color: toneFor(t, s.return3m), fontSize: t.font.micro, fontFamily: t.mono, marginTop: 2 }}>
                    {pctSigned(s.return3m)}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </Card>

        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <Inputs
            items={[
              { label: 'Method', value: 'equal weight, daily rebalance' },
              { label: 'Ranking', value: 'same as stocks' },
              { label: 'As of', value: mediumDate(manifest.tradingDate) },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
});
