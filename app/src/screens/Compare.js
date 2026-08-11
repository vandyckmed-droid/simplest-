// Compare several securities on one normalised chart.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import Chart from '../components/Chart';
import { Card, SectionTitle, Segmented, Divider, EmptyState, Button, Inputs } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import { bySymbol, closesFor, dates, seriesFor, benchmark } from '../data';
import { rebase } from '../analytics/returns';
import { isNum } from '../analytics/stats';
import { num, pctSigned, shortDate } from '../format';

const RANGES = [
  { label: '3M', value: 63 },
  { label: '6M', value: 126 },
  { label: '1Y', value: 252 },
  { label: '2Y', value: 520 },
];

const MAX_LINES = 6;

export default function Compare({ nav, params }) {
  const { t } = useTheme();
  const app = useAppState();
  const [range, setRange] = useState(252);
  const [withBenchmark, setWithBenchmark] = useState(true);
  const [dropped, setDropped] = useState([]);

  const palette = [t.accent, t.up, t.warn, '#A855F7', '#06B6D4', '#F97316'];

  const symbols = useMemo(() => {
    const base = (params.symbols && params.symbols.length ? params.symbols : app.selected).filter(
      (s) => !dropped.includes(s)
    );
    return base.slice(0, MAX_LINES);
  }, [params.symbols, app.selected, dropped]);

  const sliceDates = dates.slice(-range);

  const series = useMemo(() => {
    const out = symbols
      .map((sym, i) => {
        const closes = closesFor(sym);
        if (!closes) return null;
        return {
          label: sym,
          values: rebase(closes.slice(-range)),
          color: palette[i % palette.length],
          width: 2,
        };
      })
      .filter(Boolean);

    if (withBenchmark) {
      const b = seriesFor({ kind: 'benchmark' });
      if (b) {
        out.push({
          label: benchmark.symbol,
          values: rebase(b.values.slice(-range)),
          color: t.textMuted,
          width: 1.6,
        });
      }
    }
    return out;
  }, [symbols, range, withBenchmark, t]);

  const table = useMemo(
    () =>
      series
        .map((s) => {
          const clean = s.values.filter(isNum);
          const ret = clean.length > 1 ? clean[clean.length - 1] / clean[0] - 1 : null;
          return { label: s.label, color: s.color, ret };
        })
        .sort((a, b) => (b.ret ?? -99) - (a.ret ?? -99)),
    [series]
  );

  if (symbols.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Compare" nav={nav} />
        <EmptyState
          title="Nothing to compare"
          body="Select two or more stocks and they will appear here on one normalised chart."
          action="Browse rankings"
          onAction={() => nav.switchTab('rankings')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Compare"
        subtitle={`${symbols.length} securities, rebased to 100`}
        nav={nav}
        action="Search"
        onAction={() => nav.push('search')}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Card padded={false}>
            <View style={{ padding: 14, paddingBottom: 4 }}>
              <Text style={{ color: t.textMuted, fontSize: t.font.micro, fontWeight: '600', letterSpacing: 0.5 }}>
                NORMALISED PERFORMANCE
              </Text>
              <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 3 }}>
                All lines start at 100 on {shortDate(sliceDates[0])}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 10 }}>
              <Chart series={series} dates={sliceDates} height={220} baseline={100} fill={false} yFormat={(v) => v.toFixed(0)} />
            </View>
            <View style={{ padding: 14, paddingTop: 8 }}>
              <Segmented options={RANGES} value={range} onChange={setRange} />
              <View style={{ height: 8 }} />
              <Segmented
                options={[
                  { label: 'Stocks only', value: false },
                  { label: `Include ${benchmark.symbol}`, value: true },
                ]}
                value={withBenchmark}
                onChange={setWithBenchmark}
              />
            </View>
          </Card>
        </View>

        <SectionTitle>Performance over the window</SectionTitle>
        <Card style={{ marginHorizontal: 16 }} padded={false}>
          {table.map((r, i) => (
            <View key={r.label}>
              {i > 0 ? <Divider inset={16} /> : null}
              <View style={styles.tableRow}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color, marginRight: 10 }} />
                <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '600', flex: 1 }}>{r.label}</Text>
                <Text
                  style={{
                    color: toneFor(t, r.ret),
                    fontSize: t.font.body,
                    fontWeight: '700',
                    fontFamily: t.mono,
                  }}
                >
                  {pctSigned(r.ret)}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <SectionTitle>Lines on the chart</SectionTitle>
        <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap' }}>
          {symbols.map((s, i) => (
            <Pressable
              key={s}
              onPress={() => setDropped([...dropped, s])}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.surface,
                borderRadius: t.radius.pill,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 8,
                marginBottom: 8,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: t.border,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: palette[i % palette.length],
                  marginRight: 7,
                }}
              />
              <Text style={{ color: t.text, fontSize: t.font.label, fontWeight: '600' }}>{s}</Text>
              <Text style={{ color: t.textFaint, fontSize: t.font.body, marginLeft: 8 }}>×</Text>
            </Pressable>
          ))}
        </View>

        {dropped.length > 0 ? (
          <View style={{ paddingHorizontal: 16, marginTop: 6 }}>
            <Button label="Restore removed lines" tone="ghost" onPress={() => setDropped([])} />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <Inputs
            items={[
              { label: 'Window', value: `${sliceDates.length} trading days` },
              { label: 'Basis', value: 'adjusted closes' },
              { label: 'Max lines', value: String(MAX_LINES) },
            ]}
          />
          {app.selected.length > MAX_LINES ? (
            <Text style={{ color: t.warn, fontSize: t.font.micro, marginTop: 8, lineHeight: 17 }}>
              You have {app.selected.length} selected; the first {MAX_LINES} are charted so the lines stay
              readable on a phone.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
});
