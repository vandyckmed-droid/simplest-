// Methodology: every number in the app, explained in the order it is produced.

import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import { Card, SectionTitle, Divider, StatRow, Pill } from '../components/ui';
import { useTheme } from '../theme';
import { manifest, universe, sectorSeries, industrySeries, benchmark, macro, dates } from '../data';
import { compactMoney, mediumDate, relativeTime } from '../format';
import { explainMeasure } from '../analytics/momentum';

export default function Methodology({ nav }) {
  const { t } = useTheme();
  const cfg = manifest.config;
  const m = manifest.methodology;

  const Para = ({ children, muted }) => (
    <Text
      style={{
        color: muted ? t.textMuted : t.text,
        fontSize: muted ? t.font.label : t.font.body,
        lineHeight: muted ? 21 : 24,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Methodology"
        subtitle={`Data through ${mediumDate(manifest.tradingDate)}`}
        nav={nav}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* --------------------------------------------------------- freshness */}
        <SectionTitle>Freshness</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="Rankings represent" value={mediumDate(manifest.tradingDate)} mono={false} />
          <Divider />
          <StatRow label="Dataset built" value={relativeTime(manifest.builtAt)} mono={false} />
          <Divider />
          <StatRow
            label="History in this app"
            value={`${dates.length} trading days`}
            hint={`Charts span ${mediumDate(dates[0])} to ${mediumDate(manifest.tradingDate)}`}
          />
          <Divider />
          <StatRow
            label="Full dataset"
            value={`${manifest.calendar.days} trading days`}
            hint={`Back to ${mediumDate(manifest.calendar.first)}. The scores were computed over this full history; the app carries the recent slice its charts can show.`}
          />
          <Para muted>
            The trading date is the last session with a complete close for the market as a whole. If today is
            still open, the rankings deliberately show yesterday rather than a half-formed bar.
          </Para>
        </Card>

        {/* ---------------------------------------------------------- universe */}
        <SectionTitle>1. Building the universe</SectionTitle>
        <Card style={styles.card}>
          <Para>
            The market is screened sector by sector, then the largest names that clear every liquidity test
            are kept — {cfg.perSector} per sector, {manifest.counts.universe} in total.
          </Para>
          <Divider />
          <StatRow label="Per sector" value={String(cfg.perSector)} />
          <Divider />
          <StatRow label="Minimum company size" value={compactMoney(cfg.screen.minMarketCap)} />
          <Divider />
          <StatRow
            label="Minimum daily turnover"
            value={compactMoney(cfg.liquidity.minMedianDollarVolume)}
            hint={`Median over ${cfg.liquidity.lookbackDays} sessions, measured from real bars rather than a screener snapshot`}
          />
          <Divider />
          <StatRow label="Minimum share price" value={`$${cfg.liquidity.minPrice}`} />
          <Divider />
          <StatRow
            label="Minimum history"
            value={`${cfg.history.minBarsRequired} daily bars`}
            hint="Names with less history are excluded rather than ranked on a short window"
          />
          <Divider />
          <StatRow label="Exchanges" value={cfg.screen.exchanges.join(', ')} mono={false} />
          <Para muted>
            Funds, ETFs and non-trading lines are excluded. Where a company has several share classes, only
            the most liquid line is kept — {manifest.dataQuality.duplicatesDropped} duplicate listing
            {manifest.dataQuality.duplicatesDropped === 1 ? ' was' : 's were'} folded away in this build, and{' '}
            {manifest.dataQuality.excludedCount} candidates failed the liquidity or history gate.
          </Para>
        </Card>

        {/* ---------------------------------------------------------- prices */}
        <SectionTitle>2. Prices</SectionTitle>
        <Card style={styles.card}>
          <Para>{m.priceBasis}.</Para>
          <Para muted>
            Adjusted prices mean a dividend or a stock split does not show up as a fake gain or loss. Every
            series is placed on one shared trading calendar built from the equity sessions themselves, so a
            window of 252 days really is a year of market activity. Instruments that trade at other times —
            Bitcoin in particular — are sampled onto that calendar rather than being allowed to stretch it.
          </Para>
          <Para muted>
            Days a security did not trade are recorded as "no observation", never as a flat day, so a gap
            cannot masquerade as zero volatility.
          </Para>
        </Card>

        {/* --------------------------------------------------------- momentum */}
        <SectionTitle>3. Momentum scores</SectionTitle>
        {['score12', 'score6', 'blended'].map((key) => {
          const e = explainMeasure(key);
          return (
            <Card key={key} style={[styles.card, { marginBottom: 12 }]}>
              <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '700' }}>{e.title}</Text>
              <View style={{ marginTop: 8, marginBottom: 10 }}>
                <Pill label={e.formula} tone="accent" />
              </View>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, lineHeight: 21 }}>{e.window}</Text>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, lineHeight: 21, marginTop: 8 }}>
                {e.detail}
              </Text>
            </Card>
          );
        })}

        <Card style={styles.card}>
          <StatRow label="Return annualisation" value="geometric" mono={false} hint={m.returnAnnualisation} />
          <Divider />
          <StatRow label="Volatility" value="√252 scaling" mono={false} hint={m.volatility} />
          <Divider />
          <StatRow label="Blend weights" value="50 / 50" mono={false} />
          <Para muted>
            A security needs a full window to receive a score. If it has fewer than 253 daily bars it has no
            12-1 score, fewer than 127 and it has no 6-1 score, and without both it gets no blended score.
            The app shows a dash in those places rather than a number built from a shorter period.
          </Para>
        </Card>

        {/* ------------------------------------------------------------ ranks */}
        <SectionTitle>4. Ranks and z-scores</SectionTitle>
        <Card style={styles.card}>
          <Para>Every measure is ranked twice: against the whole universe, and against the security&apos;s own sector.</Para>
          <Divider />
          <StatRow label="Ranking method" value="ties share a rank, 1 = best" mono={false} hint={m.ranking} />
          <Divider />
          <StatRow label="Sector peer groups" value={`${manifest.counts.sectors} sectors`} />
          <Divider />
          <StatRow
            label="Industry peer groups"
            value={`${manifest.counts.industriesTagged} industries`}
            hint={`An industry is ranked as its own group once at least ${cfg.industries.minCountToTag} universe members belong to it`}
          />
          <Para muted>
            A z-score says how far above or below its peer group a security sits, measured in standard
            deviations of that group. Zero is the sector average; +1.0 means one standard deviation better
            than the sector. Groups where every member scores the same, or which are too small to have a
            spread, show a dash instead of a fabricated zero.
          </Para>
        </Card>

        {/* ---------------------------------------------------------- sectors */}
        <SectionTitle>5. Sector and industry series</SectionTitle>
        <Card style={styles.card}>
          <Para>{m.sectorIndices}.</Para>
          <Para muted>
            Each series behaves like a simple synthetic sector fund: every day it earns the average of that
            day&apos;s returns across its members. Because the constituents are exactly the stocks in the
            universe, a sector&apos;s chart and its members&apos; rankings always describe the same thing.
            The same momentum framework is then applied to those series, so a sector rank means the same as
            a stock rank.
          </Para>
          <Divider />
          <StatRow label="Sector series" value={String(sectorSeries.length)} />
          <Divider />
          <StatRow label="Industry series" value={String(industrySeries.length)} />
          <Divider />
          <StatRow label="Benchmark" value={`${benchmark.symbol} · ${benchmark.label}`} mono={false} />
        </Card>

        {/* ------------------------------------------------------------- risk */}
        <SectionTitle>6. Movement and risk</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="Average true range" value="14 days, Wilder" mono={false} hint={m.atr} />
          <Divider />
          <StatRow
            label="Basket volatility"
            value="full covariance"
            mono={false}
            hint="Weights and the covariance of daily returns over the last 252 overlapping sessions"
          />
          <Divider />
          <StatRow
            label="Normal day"
            value="1 standard deviation"
            mono={false}
            hint="Roughly two days in three land inside this range"
          />
          <Divider />
          <StatRow
            label="Rough day"
            value="1.96 standard deviations"
            mono={false}
            hint="Exceeded, in one direction or the other, about one session in twenty"
          />
          <Para muted>
            Correlations use the same overlapping window. Only dates where every holding traded are used, so
            the relationships are measured on genuinely simultaneous observations.
          </Para>
          <Para muted>
            "Genuinely independent positions" compares the volatility of the basket against the weighted
            average volatility of its parts. If the holdings all move together the two are equal and the
            figure is 1; the more they diverge, the higher it climbs, up to the number of holdings.
          </Para>
        </Card>

        {/* --------------------------------------------------------- quality */}
        <SectionTitle>7. Data quality</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="Securities ranked" value={String(manifest.counts.universe)} />
          <Divider />
          <StatRow label="Duplicate listings removed" value={String(manifest.dataQuality.duplicatesDropped)} />
          <Divider />
          <StatRow label="Excluded by liquidity or history" value={String(manifest.dataQuality.excludedCount)} />
          <Divider />
          <StatRow label="Series with cleaning notes" value={String(manifest.dataQuality.issueCount)} />
          <Divider />
          <StatRow
            label="Names with an incomplete window"
            value={String(manifest.dataQuality.shortHistory.length)}
            hint="Shown with a dash on the affected measure rather than a partial score"
          />
          {manifest.dataQuality.warnings && manifest.dataQuality.warnings.length ? (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: t.warn, fontSize: t.font.label, fontWeight: '600', marginBottom: 6 }}>
                Build warnings
              </Text>
              {manifest.dataQuality.warnings.map((w, i) => (
                <Text key={i} style={{ color: t.textMuted, fontSize: t.font.micro, lineHeight: 17 }}>
                  • {w}
                </Text>
              ))}
            </View>
          ) : null}
        </Card>

        {/* --------------------------------------------------------- sources */}
        <SectionTitle>Sources</SectionTitle>
        <Card style={styles.card}>
          <Para muted>
            Prices, fundamentals, the screener and company logos come from {manifest.provider}. Company
            websites are linked from each ticker page, and each ticker also links to Wikipedia for
            background reading. Where a market could not be sourced directly, a liquid fund stands in and
            the substitution is labelled on the macro card.
          </Para>
          {macro.filter((x) => x.substituted).map((x) => (
            <Text key={x.key} style={{ color: t.warn, fontSize: t.font.micro, lineHeight: 17, marginTop: 4 }}>
              • {x.label}: showing {x.symbol} in place of {x.requestedSymbol}.
              {x.note ? ` ${x.note}` : ''}
            </Text>
          ))}
          <Text
            onPress={() => Linking.openURL('https://site.financialmodelingprep.com/').catch(() => {})}
            style={{ color: t.accent, fontSize: t.font.label, fontWeight: '600', marginTop: 12 }}
          >
            About the data provider ›
          </Text>
        </Card>

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, lineHeight: 17 }}>
            This app is a research and educational tool. Nothing in it is investment advice, and past
            movement is not a forecast of future movement.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16 },
});
