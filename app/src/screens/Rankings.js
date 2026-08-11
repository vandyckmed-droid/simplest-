// Rankings: the full universe, filterable, sortable, hideable, selectable.

import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import StockRow from '../components/StockRow';
import { Card, Chip, ChipRow, Segmented, Divider, Button, EmptyState, Pill } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import { universe, SECTORS, closesFor, manifest } from '../data';
import { explainMeasure } from '../analytics/momentum';
import { compactMoney, mediumDate, num, pct, pctSigned, zLabel } from '../format';

const MEASURES = [
  { label: '12-1', value: 'score12' },
  { label: '6-1', value: 'score6' },
  { label: 'Blend', value: 'blended' },
];

const SORTS = [
  { key: 'rank', label: 'Rank (best first)' },
  { key: 'z', label: 'Sector z-score' },
  { key: 'return1m', label: 'Return, last month' },
  { key: 'return12m', label: 'Return, last 12 months' },
  { key: 'atrPct', label: 'Daily swing (ATR %)' },
  { key: 'marketCap', label: 'Company size' },
  { key: 'symbol', label: 'Ticker A–Z' },
];

export default function Rankings({ nav }) {
  const { t } = useTheme();
  const app = useAppState();
  const [sheet, setSheet] = useState(false);
  const f = app.filters;

  const rows = useMemo(() => {
    let list = universe.filter((r) => !app.hidden.includes(r.symbol));
    if (f.sectors.length) list = list.filter((r) => f.sectors.includes(r.sector));
    if (f.onlySelected) list = list.filter((r) => app.selected.includes(r.symbol));
    if (typeof f.minPrice === 'number') list = list.filter((r) => (r.lastClose || 0) >= f.minPrice);

    const dir = f.sortDir === 'asc' ? 1 : -1;
    const measure = f.measure;

    const value = (r) => {
      switch (f.sortKey) {
        case 'rank': {
          const rk = r.ranks[measure];
          const v = f.scope === 'sector' ? rk.group : rk.global;
          return v === null ? Infinity : v;
        }
        case 'z': {
          const z = r.ranks[measure].groupZ;
          return z === null ? -Infinity : -z; // higher z first when ascending
        }
        case 'symbol':
          return r.symbol;
        default: {
          const v = r[f.sortKey];
          return typeof v === 'number' ? -v : -Infinity; // bigger first when ascending
        }
      }
    };

    return list.slice().sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      if (va === vb) return a.symbol.localeCompare(b.symbol);
      return (va - vb) * dir;
    });
  }, [f, app.hidden, app.selected]);

  const explain = explainMeasure(f.measure);

  const renderItem = ({ item, index }) => {
    const rk = item.ranks[f.measure];
    const rankValue = f.scope === 'sector' ? rk.group : rk.global;
    const rankOf = f.scope === 'sector' ? rk.groupOf : rk.globalOf;
    const score = item.scores[f.measure];

    let secondaryText;
    let secondaryTone = t.textMuted;
    if (f.sortKey === 'return1m' || f.sortKey === 'return12m') {
      secondaryText = pctSigned(item[f.sortKey]);
      secondaryTone = toneFor(t, item[f.sortKey]);
    } else if (f.sortKey === 'atrPct') {
      secondaryText = `${pct(item.atrPct, 1)} / day`;
    } else if (f.sortKey === 'marketCap') {
      secondaryText = compactMoney(item.marketCap);
    } else if (f.sortKey === 'z') {
      secondaryText = `${zLabel(rk.groupZ)} in sector`;
    } else {
      secondaryText = rankValue ? `#${rankValue} of ${rankOf}` : 'not ranked';
    }

    return (
      <StockRow
        row={item}
        rank={f.sortKey === 'rank' ? index + 1 : undefined}
        primary={score === null ? '—' : num(score, 2)}
        secondary={{ text: secondaryText, tone: secondaryTone }}
        spark={{ values: (closesFor(item.symbol) || []).slice(-90), color: toneFor(t, item.return3m) }}
        selected={app.selected.includes(item.symbol)}
        onPress={() => nav.push('ticker', { symbol: item.symbol })}
        onToggleSelect={() => app.toggleSelected(item.symbol)}
        onLongPress={() => app.toggleHidden(item.symbol)}
        showSector
      />
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        large
        title="Rankings"
        subtitle={`${rows.length} of ${manifest.counts.universe} securities · ${explain.title}`}
        nav={nav}
        action="Filters"
        onAction={() => setSheet(true)}
      />

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented options={MEASURES} value={f.measure} onChange={(v) => app.setFilters({ measure: v })} />
        <View style={{ height: 8 }} />
        <Segmented
          options={[
            { label: 'Global rank', value: 'global' },
            { label: 'Within sector', value: 'sector' },
          ]}
          value={f.scope}
          onChange={(v) => app.setFilters({ scope: v })}
        />
      </View>

      <View style={{ marginTop: 12 }}>
        <ChipRow>
          <Chip label="All sectors" active={f.sectors.length === 0} onPress={() => app.setFilters({ sectors: [] })} />
          {SECTORS.map((s) => (
            <Chip
              key={s}
              label={s}
              active={f.sectors.includes(s)}
              onPress={() =>
                app.setFilters({
                  sectors: f.sectors.includes(s) ? f.sectors.filter((x) => x !== s) : [...f.sectors, s],
                })
              }
            />
          ))}
        </ChipRow>
      </View>

      <View style={styles.metaBar}>
        <Text style={{ color: t.textFaint, fontSize: t.font.micro, flex: 1 }}>
          Sorted by {SORTS.find((s) => s.key === f.sortKey)?.label.toLowerCase()} · tap to open · hold to hide
        </Text>
        {app.hidden.length > 0 ? (
          <Pressable onPress={app.clearHidden} hitSlop={8}>
            <Text style={{ color: t.accent, fontSize: t.font.micro, fontWeight: '700' }}>
              {app.hidden.length} hidden — show all
            </Text>
          </Pressable>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          body="Every security is filtered out or hidden. Loosen the filters to bring them back."
          action="Reset filters"
          onAction={() => {
            app.resetFilters();
            app.clearHidden();
          }}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.symbol}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider inset={64} />}
          contentContainerStyle={{ paddingBottom: 28 }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews
        />
      )}

      {app.selected.length > 0 ? (
        <View style={[styles.selectionBar, { backgroundColor: t.accent }]}>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.font.body, flex: 1 }}>
            {app.selected.length} selected
          </Text>
          <Pressable onPress={() => nav.push('compare', { symbols: app.selected.slice(0, 6) })} hitSlop={8}>
            <Text style={styles.selectionAction}>Compare</Text>
          </Pressable>
          <Pressable onPress={() => nav.switchTab('portfolio')} hitSlop={8}>
            <Text style={styles.selectionAction}>Basket ›</Text>
          </Pressable>
        </View>
      ) : null}

      <FilterSheet visible={sheet} onClose={() => setSheet(false)} nav={nav} explain={explain} />
    </View>
  );
}

function FilterSheet({ visible, onClose, nav, explain }) {
  const { t } = useTheme();
  const app = useAppState();
  const f = app.filters;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.sheetBackdrop, { backgroundColor: t.scrim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={[styles.sheetHandle, { backgroundColor: t.borderStrong }]} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 34 }}>
            <Text style={{ color: t.text, fontSize: t.font.heading, fontWeight: '700' }}>Sort and filter</Text>

            <Text style={[styles.sheetLabel, { color: t.textMuted }]}>SORT BY</Text>
            <Card padded={false}>
              {SORTS.map((s, i) => (
                <View key={s.key}>
                  {i > 0 ? <Divider inset={16} /> : null}
                  <Pressable
                    onPress={() => app.setFilters({ sortKey: s.key })}
                    style={({ pressed }) => [styles.sheetRow, { backgroundColor: pressed ? t.surface : 'transparent' }]}
                  >
                    <Text style={{ color: t.text, fontSize: t.font.body, flex: 1 }}>{s.label}</Text>
                    {f.sortKey === s.key ? (
                      <Text style={{ color: t.accent, fontSize: 17, fontWeight: '700' }}>✓</Text>
                    ) : null}
                  </Pressable>
                </View>
              ))}
            </Card>

            <Text style={[styles.sheetLabel, { color: t.textMuted }]}>DIRECTION</Text>
            <Segmented
              options={[
                { label: 'Best first', value: 'asc' },
                { label: 'Worst first', value: 'desc' },
              ]}
              value={f.sortDir}
              onChange={(v) => app.setFilters({ sortDir: v })}
            />

            <Text style={[styles.sheetLabel, { color: t.textMuted }]}>SHOW</Text>
            <Card padded={false}>
              <Pressable
                onPress={() => app.setFilters({ onlySelected: !f.onlySelected })}
                style={styles.sheetRow}
              >
                <Text style={{ color: t.text, fontSize: t.font.body, flex: 1 }}>Only my selection</Text>
                {f.onlySelected ? <Text style={{ color: t.accent, fontSize: 17, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
              <Divider inset={16} />
              <Pressable
                onPress={() => app.setFilters({ minPrice: f.minPrice ? null : 20 })}
                style={styles.sheetRow}
              >
                <Text style={{ color: t.text, fontSize: t.font.body, flex: 1 }}>Hide shares under $20</Text>
                {f.minPrice ? <Text style={{ color: t.accent, fontSize: 17, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
            </Card>

            <Text style={[styles.sheetLabel, { color: t.textMuted }]}>CURRENT MEASURE</Text>
            <Card>
              <Text style={{ color: t.text, fontSize: t.font.body, fontWeight: '700' }}>{explain.title}</Text>
              <Text style={{ color: t.textMuted, fontSize: t.font.label, marginTop: 6 }}>{explain.formula}</Text>
              <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 6, lineHeight: 17 }}>
                {explain.window}
              </Text>
              <Pressable
                onPress={() => {
                  onClose();
                  nav.push('methodology');
                }}
                style={{ marginTop: 12 }}
              >
                <Text style={{ color: t.accent, fontSize: t.font.label, fontWeight: '700' }}>
                  Full methodology ›
                </Text>
              </Pressable>
            </Card>

            <View style={{ flexDirection: 'row', marginTop: 20 }}>
              <Button
                label="Reset"
                tone="ghost"
                onPress={() => {
                  app.resetFilters();
                  app.clearHidden();
                }}
                style={{ flex: 1, marginRight: 10 }}
              />
              <Button label="Done" onPress={onClose} style={{ flex: 2 }} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  selectionAction: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, marginLeft: 18 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetHandleWrap: { alignItems: 'center', paddingTop: 8 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2 },
  sheetLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
});
