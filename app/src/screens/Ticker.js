// One security, in full.
//
// The rule for this screen: no number appears without the window that produced
// it. A rank is always "N of M", a score always shows its return and volatility
// inputs, and a chart always states the period it covers.

import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import Chart from '../components/Chart';
import Logo from '../components/Logo';
import { Card, SectionTitle, Segmented, StatRow, Divider, Pill, Button, Inputs } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import {
  bySymbol,
  closesFor,
  dates,
  seriesFor,
  benchmarksFor,
  industryIsTagged,
  manifest,
  benchmark,
} from '../data';
import { rebase } from '../analytics/returns';
import { explainMeasure } from '../analytics/momentum';
import { isNum } from '../analytics/stats';
import {
  compactMoney,
  mediumDate,
  money,
  num,
  pct,
  pctSigned,
  shortDate,
  zLabel,
} from '../format';

const RANGES = [
  { label: '3M', value: 63 },
  { label: '6M', value: 126 },
  { label: '1Y', value: 252 },
  { label: '2Y', value: 520 },
];

const MEASURE_KEYS = [
  { key: 'score12', componentKey: 'h12_1', title: '12-1 momentum' },
  { key: 'score6', componentKey: 'h6_1', title: '6-1 momentum' },
  { key: 'blended', componentKey: null, title: 'Blended' },
];

export default function Ticker({ nav, params }) {
  const { t } = useTheme();
  const app = useAppState();
  const row = bySymbol.get(params.symbol);
  const [range, setRange] = useState(252);
  const [compareRef, setCompareRef] = useState(null);
  const [scrub, setScrub] = useState(null);

  useEffect(() => {
    if (row) app.noteVisit(row.symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.symbol]);

  const closes = row ? closesFor(row.symbol) : null;

  const chart = useMemo(() => {
    if (!closes) return null;
    const n = Math.min(range, closes.length);
    const slice = closes.slice(-n);
    const sliceDates = dates.slice(-n);

    if (!compareRef) {
      return {
        dates: sliceDates,
        series: [{ label: row.symbol, values: slice, color: t.accent, width: 2.2 }],
        normalised: false,
      };
    }

    const other = seriesFor(compareRef);
    const otherSlice = other ? other.values.slice(-n) : [];
    return {
      dates: sliceDates,
      series: [
        { label: row.symbol, values: rebase(slice), color: t.accent, width: 2.2 },
        { label: other ? other.label : '—', values: rebase(otherSlice), color: t.textMuted, width: 1.8 },
      ],
      normalised: true,
    };
  }, [closes, range, compareRef, t, row]);

  if (!row) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Not found" nav={nav} />
        <Text style={{ color: t.textMuted, padding: 24 }}>That security is not in the current universe.</Text>
      </View>
    );
  }

  const windowReturn = (() => {
    if (!closes) return null;
    const n = Math.min(range, closes.length);
    const slice = closes.slice(-n).filter(isNum);
    if (slice.length < 2) return null;
    return slice[slice.length - 1] / slice[0] - 1;
  })();

  const selected = app.selected.includes(row.symbol);
  const benchOptions = benchmarksFor(row.symbol);
  const scrubDate = scrub !== null && chart ? chart.dates[scrub] : null;

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={row.symbol}
        subtitle={row.name}
        nav={nav}
        action={selected ? 'Selected ✓' : 'Select'}
        onAction={() => app.toggleSelected(row.symbol)}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* ------------------------------------------------------- identity */}
        <View style={styles.hero}>
          <Logo symbol={row.symbol} uri={row.logo} size={52} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: t.text, fontSize: 30, fontWeight: '700', fontFamily: t.mono, letterSpacing: -0.8 }}>
              {money(row.lastClose)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: toneFor(t, row.return1m), fontSize: t.font.body, fontWeight: '700', fontFamily: t.mono }}>
                {pctSigned(row.return1m)}
              </Text>
              <Text style={{ color: t.textFaint, fontSize: t.font.label, marginLeft: 6 }}>past month</Text>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 4 }}>
          <Pressable onPress={() => nav.push('group', { kind: 'sector', key: row.sector })}>
            <Pill label={row.sector} tone="accent" />
          </Pressable>
          <View style={{ width: 8 }} />
          {row.industry ? (
            <Pressable
              onPress={() =>
                industryIsTagged(row.industry)
                  ? nav.push('group', { kind: 'industry', key: row.industry })
                  : nav.push('group', { kind: 'industryList', key: row.industry })
              }
            >
              <Pill label={row.industry} tone="neutral" />
            </Pressable>
          ) : null}
        </View>

        {/* ---------------------------------------------------------- chart */}
        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <Card padded={false}>
            <View style={{ padding: 14, paddingBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.textMuted, fontSize: t.font.micro, fontWeight: '600', letterSpacing: 0.5 }}>
                    {compareRef ? 'RELATIVE PERFORMANCE' : 'PRICE'}
                  </Text>
                  <Text style={{ color: toneFor(t, windowReturn), fontSize: 20, fontWeight: '700', fontFamily: t.mono, marginTop: 3 }}>
                    {pctSigned(windowReturn)}
                  </Text>
                </View>
                <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }}>
                  {scrubDate ? shortDate(scrubDate) : `${chart ? chart.dates.length : 0} trading days`}
                </Text>
              </View>
            </View>

            <View style={{ paddingHorizontal: 10 }}>
              {chart ? (
                <Chart
                  series={chart.series}
                  dates={chart.dates}
                  height={190}
                  onScrub={setScrub}
                  baseline={chart.normalised ? 100 : null}
                  yFormat={(v) => (chart.normalised ? v.toFixed(0) : v >= 1000 ? v.toFixed(0) : v.toFixed(1))}
                />
              ) : null}
            </View>

            <View style={{ padding: 14, paddingTop: 10 }}>
              <Segmented
                options={RANGES.map((r) => ({ label: r.label, value: r.value }))}
                value={range}
                onChange={setRange}
              />
              <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, marginBottom: 6 }}>
                COMPARE AGAINST
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <CompareChip label="None" active={!compareRef} onPress={() => setCompareRef(null)} />
                {benchOptions.map((b) => (
                  <CompareChip
                    key={`${b.kind}:${b.key}`}
                    label={b.label}
                    active={compareRef && compareRef.kind === b.kind && compareRef.key === b.key}
                    onPress={() => setCompareRef(b)}
                  />
                ))}
              </ScrollView>
              {chart && chart.normalised ? (
                <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 16 }}>
                  Both lines start at 100 on {shortDate(chart.dates[0])}, so the gap between them is the
                  difference in performance over the period.
                </Text>
              ) : null}
            </View>
          </Card>
        </View>

        {/* --------------------------------------------------------- scores */}
        <SectionTitle action="Methodology" onAction={() => nav.push('methodology')}>
          Momentum scores
        </SectionTitle>
        {MEASURE_KEYS.map((m) => (
          <ScoreCard key={m.key} row={row} measure={m} nav={nav} />
        ))}

        {/* ----------------------------------------------------------- risk */}
        <SectionTitle>How much it moves</SectionTitle>
        <Card style={styles.card}>
          <StatRow
            label="Typical daily swing"
            value={pct(row.atrPct, 2)}
            hint={`14-day average true range, ${money(row.atr14)} per share`}
          />
          <Divider />
          <StatRow
            label="Annualised volatility"
            value={pct(row.components.h12_1 ? row.components.h12_1.annVol : null)}
            hint="Daily log returns over the 12-1 window, × √252"
          />
          <Divider />
          <StatRow
            label="Deepest fall, past year"
            value={pct(row.maxDrawdown1y)}
            tone={t.down}
            hint="Peak to trough over the last 252 trading days"
          />
          <Divider />
          <StatRow label="Beta" value={num(row.beta, 2)} hint="Sensitivity to the broad market" />
        </Card>

        {/* -------------------------------------------------------- returns */}
        <SectionTitle>Plain returns</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="1 month" value={pctSigned(row.return1m)} tone={toneFor(t, row.return1m)} />
          <Divider />
          <StatRow label="3 months" value={pctSigned(row.return3m)} tone={toneFor(t, row.return3m)} />
          <Divider />
          <StatRow label="12 months" value={pctSigned(row.return12m)} tone={toneFor(t, row.return12m)} />
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 16 }}>
            These are unadjusted total returns to the latest close. The momentum scores above deliberately
            skip the most recent month, so they will not match these figures.
          </Text>
        </Card>

        {/* -------------------------------------------------------- company */}
        <SectionTitle>Company</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="Market value" value={compactMoney(row.marketCap)} />
          <Divider />
          <StatRow
            label="Sector"
            value={row.sector}
            mono={false}
            onPress={() => nav.push('group', { kind: 'sector', key: row.sector })}
          />
          <Divider />
          <StatRow
            label="Industry"
            value={row.industry || '—'}
            mono={false}
            hint={
              row.industry && !industryIsTagged(row.industry)
                ? `Fewer than ${manifest.config.industries.minCountToTag} names here, so it is a label rather than a ranked group`
                : undefined
            }
            onPress={
              row.industry
                ? () =>
                    industryIsTagged(row.industry)
                      ? nav.push('group', { kind: 'industry', key: row.industry })
                      : nav.push('group', { kind: 'industryList', key: row.industry })
                : undefined
            }
          />
          <Divider />
          <StatRow label="Listed on" value={row.exchange} mono={false} />
          <Divider />
          <StatRow
            label="Median daily turnover"
            value={compactMoney(row.medianDollarVolume)}
            hint="Median dollar volume over the last 60 sessions"
          />
          {row.employees ? (
            <>
              <Divider />
              <StatRow label="Employees" value={Number(row.employees).toLocaleString('en-US')} />
            </>
          ) : null}
        </Card>

        {row.description ? (
          <Card style={[styles.card, { marginTop: 12 }]}>
            <Text style={{ color: t.textMuted, fontSize: t.font.label, lineHeight: 21 }}>{row.description}</Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginTop: 12 }}>
          {row.website ? (
            <Button
              label="Website"
              tone="ghost"
              onPress={() => Linking.openURL(row.website).catch(() => {})}
              style={{ flex: 1, marginRight: 10 }}
            />
          ) : null}
          <Button
            label="Wikipedia"
            tone="ghost"
            onPress={() =>
              Linking.openURL(
                `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(row.name || row.symbol)}`
              ).catch(() => {})
            }
            style={{ flex: 1 }}
          />
        </View>

        {/* ---------------------------------------------------- data notes */}
        <SectionTitle>Data behind this page</SectionTitle>
        <Card style={styles.card}>
          <Inputs
            items={[
              { label: 'Price basis', value: 'adjusted closes' },
              { label: 'History', value: `${row.bars} daily bars` },
              { label: 'From', value: shortDate(row.firstDate) },
              { label: 'Through', value: mediumDate(row.lastDate) },
            ]}
          />
          {row.coverage && row.coverage.length ? (
            <View style={{ marginTop: 10 }}>
              {row.coverage.map((c, i) => (
                <Text key={i} style={{ color: t.warn, fontSize: t.font.micro, lineHeight: 17 }}>
                  • {c}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 6, lineHeight: 17 }}>
              History is complete for every window used on this page.
            </Text>
          )}
        </Card>

        <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
          <Button
            label={selected ? 'Remove from basket' : 'Add to basket'}
            tone={selected ? 'ghost' : 'accent'}
            onPress={() => app.toggleSelected(row.symbol)}
          />
          <View style={{ height: 10 }} />
          <Button
            label={app.hidden.includes(row.symbol) ? 'Unhide from rankings' : 'Hide from rankings'}
            tone="ghost"
            onPress={() => app.toggleHidden(row.symbol)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function ScoreCard({ row, measure, nav }) {
  const { t } = useTheme();
  const score = row.scores[measure.key];
  const ranks = row.ranks[measure.key];
  const comp = measure.componentKey ? row.components[measure.componentKey] : null;
  const industryRank = row.industryRanks ? row.industryRanks[measure.key] : null;
  const explain = explainMeasure(measure.key);

  return (
    <Card style={[styles.card, { marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '700' }}>{explain.title}</Text>
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 3 }}>{explain.formula}</Text>
        </View>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '700', fontFamily: t.mono, letterSpacing: -0.5 }}>
          {score === null ? '—' : num(score, 2)}
        </Text>
      </View>

      {score === null ? (
        <Text style={{ color: t.warn, fontSize: t.font.label, marginTop: 10 }}>
          Not enough history for this window, so no score is shown rather than a partial one.
        </Text>
      ) : (
        <>
          <View style={{ height: 12 }} />
          <Divider />
          <StatRow
            label={`Rank in ${row.sector}`}
            value={ranks.group ? `${ranks.group} of ${ranks.groupOf}` : '—'}
            hint={`Sector z-score ${zLabel(ranks.groupZ)}`}
          />
          <Divider />
          <StatRow
            label="Rank across all sectors"
            value={ranks.global ? `${ranks.global} of ${ranks.globalOf}` : '—'}
          />
          {industryRank && industryRank.rank ? (
            <>
              <Divider />
              <StatRow
                label={`Rank in ${row.industry}`}
                value={`${industryRank.rank} of ${industryRank.of}`}
                hint={`Industry z-score ${zLabel(industryRank.z)}`}
              />
            </>
          ) : null}

          {comp ? (
            <>
              <Divider />
              <StatRow
                label="Annualised return"
                value={pctSigned(comp.annReturn)}
                tone={toneFor(t, comp.annReturn)}
                hint={`${pctSigned(comp.totalReturn)} total over ${comp.windowDays} trading days`}
              />
              <Divider />
              <StatRow
                label="Annualised volatility"
                value={pct(comp.annVol)}
                hint={`${comp.observations} daily returns, same window`}
              />
            </>
          ) : (
            <>
              <Divider />
              <StatRow
                label="Made from"
                value="0.5 × 12-1 + 0.5 × 6-1"
                mono={false}
                hint={`${num(row.scores.score12, 2)} and ${num(row.scores.score6, 2)}`}
              />
            </>
          )}
        </>
      )}
    </Card>
  );
}

function CompareChip({ label, active, onPress }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: t.radius.pill,
        backgroundColor: active ? t.accentSoft : t.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? t.accent : t.border,
        marginRight: 8,
      }}
    >
      <Text style={{ color: active ? t.accent : t.textMuted, fontSize: t.font.micro, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 18 },
  card: { marginHorizontal: 16 },
});
