// One security in a ranked list.
//
// The row is deliberately sparse: identity on the left, the number that the list
// is sorted by on the right, and one supporting line. Anything more and a phone
// list stops being readable.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Logo from './Logo';
import Sparkline from './Sparkline';
import { useTheme, toneFor } from '../theme';
import { num, pctSigned, zLabel } from '../format';

export default function StockRow({
  row,
  rank,
  primary,
  primaryLabel,
  secondary,
  spark,
  selected,
  onPress,
  onToggleSelect,
  onLongPress,
  showSector,
}) {
  const { t } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? t.surface : 'transparent' },
      ]}
    >
      {rank !== undefined && rank !== null ? (
        <Text style={[styles.rank, { color: t.textFaint, fontFamily: t.mono }]}>{rank}</Text>
      ) : null}

      <Logo symbol={row.symbol} uri={row.logo} size={36} />

      <View style={styles.identity}>
        <View style={styles.symbolLine}>
          <Text style={[styles.symbol, { color: t.text }]} numberOfLines={1}>
            {row.symbol}
          </Text>
          {selected ? <View style={[styles.selDot, { backgroundColor: t.accent }]} /> : null}
        </View>
        <Text style={[styles.name, { color: t.textMuted }]} numberOfLines={1}>
          {showSector ? row.sector : row.name}
        </Text>
      </View>

      {spark ? (
        <View style={styles.spark}>
          <Sparkline
            values={spark.values}
            color={spark.color || (spark.change >= 0 ? t.up : t.down)}
            width={52}
            height={22}
          />
        </View>
      ) : null}

      <View style={styles.metrics}>
        <Text style={[styles.primary, { color: t.text, fontFamily: t.mono }]}>{primary}</Text>
        {secondary ? (
          <Text style={[styles.secondary, { color: secondary.tone || t.textMuted, fontFamily: t.mono }]}>
            {secondary.text}
          </Text>
        ) : null}
      </View>

      {onToggleSelect ? (
        <Pressable
          onPress={onToggleSelect}
          hitSlop={12}
          style={[
            styles.checkbox,
            {
              borderColor: selected ? t.accent : t.borderStrong,
              backgroundColor: selected ? t.accent : 'transparent',
            },
          ]}
        >
          {selected ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

// Convenience: the standard "score + rank" presentation used by every ranked list.
export function scorePresentation(t, row, measureKey, scope) {
  const score = row.scores ? row.scores[measureKey] : null;
  const r = row.ranks ? row.ranks[measureKey] : null;
  if (!r) return { primary: '—', secondary: null };
  const rank = scope === 'sector' ? r.group : r.global;
  const of = scope === 'sector' ? r.groupOf : r.globalOf;
  return {
    primary: score === null || score === undefined ? '—' : num(score, 2),
    secondary: {
      text: rank ? `#${rank} of ${of}` : 'unranked',
      tone: t.textMuted,
    },
  };
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  rank: { width: 26, fontSize: 13, fontWeight: '600' },
  identity: { flex: 1, marginLeft: 12, marginRight: 8 },
  symbolLine: { flexDirection: 'row', alignItems: 'center' },
  symbol: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  selDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 6 },
  name: { fontSize: 12, marginTop: 2 },
  spark: { marginRight: 10 },
  metrics: { alignItems: 'flex-end', minWidth: 72 },
  primary: { fontSize: 16, fontWeight: '700' },
  secondary: { fontSize: 11, marginTop: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
