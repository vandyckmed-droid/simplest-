// Drill-down for a sector or an industry.
//
// This screen is where "broad market → sector → industry → stock" actually
// happens: every label on it is a link one level narrower.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import Chart from '../components/Chart';
import StockRow from '../components/StockRow';
import { Card, SectionTitle, Segmented, Divider, StatRow, Inputs, Pill, EmptyState } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import {
  sectorByKey,
  industryByKey,
  membersOfSector,
  membersOfIndustry,
  industriesInSector,
  closesFor,
  dates,
  seriesFor,
  benchmark,
  manifest,
} from '../data';
import { rebase } from '../analytics/returns';
import { num, pct, pctSigned, zLabel, mediumDate } from '../format';

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

export default function GroupDetail({ nav, params }) {
  const { t } = useTheme();
  const app = useAppState();
  const [measure, setMeasure] = useState('blended');
  const [range, setRange] = useState(252);
  const [vsBenchmark, setVsBenchmark] = useState(true);

  const isSector = params.kind === 'sector';
  const isTaggedIndustry = params.kind === 'industry';
  const group = isSector ? sectorByKey.get(params.key) : isTaggedIndustry ? industryByKey.get(params.key) : null;

  const members = useMemo(
    () => (isSector ? membersOfSector(params.key) : membersOfIndustry(params.key)),
    [isSector, params.key]
  );

  const ranked = useMemo(
    () => members.slice().sort((a, b) => (b.scores[measure] ?? -99) - (a.scores[measure] ?? -99)),
    [members, measure]
  );

  const industries = useMemo(() => (isSector ? industriesInSector(params.key) : []), [isSector, params.key]);

  const chart = useMemo(() => {
    if (!group) return null;
    const vals = rebase(group.values.slice(-range));
    const series = [{ label: group.label, values: vals, color: t.accent, width: 2.2 }];
    if (vsBenchmark) {
      const bench = seriesFor({ kind: 'benchmark' });
      if (bench) {
        series.push({
          label: benchmark.symbol,
          values: rebase(bench.values.slice(-range)),
          color: t.textMuted,
          width: 1.8,
        });
      }
    }
    return { series, dates: dates.slice(-range) };
  }, [group, range, vsBenchmark, t]);

  if (members.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={params.key} nav={nav} />
        <EmptyState title="No members" body="Nothing in the current universe belongs to this group." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={params.key}
        subtitle={
          isSector
            ? `Sector · ${members.length} names`
            : isTaggedIndustry
            ? `Industry · ${members.length} names · ranked group`
            : `Industry · ${members.length} names`
        }
        nav={nav}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        {group ? (
          <>
            <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
              <Card padded={false}>
                <View style={{ padding: 14, paddingBottom: 4 }}>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro, fontWeight: '600', letterSpacing: 0.5 }}>
                    EQUAL-WEIGHT INDEX
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
                    <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', fontFamily: t.mono }}>
                      {num(group.scores[measure], 2)}
                    </Text>
                    <Text style={{ color: t.textFaint, fontSize: t.font.label, marginLeft: 8 }}>
                      {MEASURES.find((m) => m.value === measure).label} score · rank{' '}
                      {group.ranks[measure].rank} of {group.ranks[measure].of}
                    </Text>
                  </View>
                </View>
                <View style={{ paddingHorizontal: 10 }}>
                  {chart ? (
                    <Chart
                      series={chart.series}
                      dates={chart.dates}
                      height={180}
                      baseline={100}
                      fill={chart.series.length === 1}
                      yFormat={(v) => v.toFixed(0)}
                    />
                  ) : null}
                </View>
                <View style={{ padding: 14, paddingTop: 8 }}>
                  <Segmented options={RANGES} value={range} onChange={setRange} />
                  <View style={{ height: 8 }} />
                  <Segmented
                    options={[
                      { label: 'Group only', value: false },
                      { label: `vs ${benchmark.symbol}`, value: true },
                    ]}
                    value={vsBenchmark}
                    onChange={setVsBenchmark}
                  />
                </View>
              </Card>
            </View>

            <SectionTitle>Group figures</SectionTitle>
            <Card style={styles.card}>
              <StatRow
                label="Annualised return, 12-1 window"
                value={pctSigned(group.components.h12_1 ? group.components.h12_1.annReturn : null)}
                tone={toneFor(t, group.components.h12_1 ? group.components.h12_1.annReturn : null)}
                hint="252 to 21 trading days ago"
              />
              <Divider />
              <StatRow
                label="Annualised volatility"
                value={pct(group.components.h12_1 ? group.components.h12_1.annVol : null)}
                hint="Same window as the return"
              />
              <Divider />
              <StatRow label="Return, last 3 months" value={pctSigned(group.return3m)} tone={toneFor(t, group.return3m)} />
              <Divider />
              <StatRow label="Return, last 12 months" value={pctSigned(group.return12m)} tone={toneFor(t, group.return12m)} />
              <Divider />
              <StatRow
                label="z-score against peer groups"
                value={zLabel(group.ranks[measure].z)}
                hint={`Measured against the other ${group.ranks[measure].of - 1} ${isSector ? 'sectors' : 'industries'}`}
              />
            </Card>
          </>
        ) : (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Card>
              <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '600' }}>
                Not ranked as a group
              </Text>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, marginTop: 6, lineHeight: 20 }}>
                Only {members.length} name{members.length === 1 ? '' : 's'} in the universe belong to this
                industry. A group needs at least {manifest.config.industries.minCountToTag} to get its own
                index and z-scores, so this page shows the members and their sector-relative standing instead.
              </Text>
            </Card>
          </View>
        )}

        {isSector && industries.length > 0 ? (
          <>
            <SectionTitle>Industries inside</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {industries.map((ind) => (
                <Pressable
                  key={ind.name}
                  onPress={() => nav.push('group', { kind: ind.tagged ? 'industry' : 'industryList', key: ind.name })}
                  style={({ pressed }) => [
                    styles.industryChip,
                    {
                      backgroundColor: pressed ? t.surfaceAlt : t.surface,
                      borderColor: ind.tagged ? t.accent : t.border,
                    },
                  ]}
                >
                  <Text style={{ color: t.text, fontSize: t.font.label, fontWeight: '600' }} numberOfLines={1}>
                    {ind.name}
                  </Text>
                  <Text style={{ color: ind.tagged ? t.accent : t.textFaint, fontSize: t.font.micro, marginTop: 3 }}>
                    {ind.count} name{ind.count === 1 ? '' : 's'}
                    {ind.tagged ? ' · ranked' : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <SectionTitle>Members</SectionTitle>
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Segmented options={MEASURES} value={measure} onChange={setMeasure} />
        </View>
        <Card style={styles.card} padded={false}>
          {ranked.map((r, i) => {
            const rk = r.ranks[measure];
            return (
              <View key={r.symbol}>
                {i > 0 ? <Divider inset={64} /> : null}
                <StockRow
                  row={r}
                  rank={i + 1}
                  primary={num(r.scores[measure], 2)}
                  secondary={{
                    text: isSector
                      ? `#${rk.group} in sector · ${zLabel(rk.groupZ)}`
                      : `#${rk.global} overall`,
                    tone: t.textMuted,
                  }}
                  spark={{ values: (closesFor(r.symbol) || []).slice(-90), color: toneFor(t, r.return3m) }}
                  selected={app.selected.includes(r.symbol)}
                  onPress={() => nav.push('ticker', { symbol: r.symbol })}
                  onToggleSelect={() => app.toggleSelected(r.symbol)}
                />
              </View>
            );
          })}
        </Card>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Inputs
            items={[
              { label: 'Members', value: String(members.length) },
              { label: 'Weighting', value: 'equal' },
              { label: 'As of', value: mediumDate(manifest.tradingDate) },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16 },
  industryChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 10,
    maxWidth: 190,
  },
});
