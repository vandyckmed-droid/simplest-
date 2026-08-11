// Search across the whole universe: ticker, company name, sector or industry.

import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Header from '../components/Header';
import StockRow from '../components/StockRow';
import { Card, SectionTitle, Divider, EmptyState, Chip, ChipRow } from '../components/ui';
import { useTheme, toneFor } from '../theme';
import { useAppState } from '../state';
import { search, universe, bySymbol, SECTORS, closesFor, manifest } from '../data';
import { num, pctSigned } from '../format';

export default function Search({ nav }) {
  const { t } = useTheme();
  const app = useAppState();
  const [query, setQuery] = useState('');

  const results = useMemo(() => search(query, 60), [query]);
  const recentRows = useMemo(
    () => app.recent.map((s) => bySymbol.get(s)).filter(Boolean),
    [app.recent]
  );

  const showing = query.trim().length > 0;

  const renderRow = (item) => (
    <StockRow
      row={item}
      primary={num(item.scores.blended, 2)}
      secondary={{
        text: item.ranks.blended.global ? `#${item.ranks.blended.global} overall` : 'not ranked',
        tone: t.textMuted,
      }}
      spark={{ values: (closesFor(item.symbol) || []).slice(-90), color: toneFor(t, item.return3m) }}
      selected={app.selected.includes(item.symbol)}
      onPress={() => nav.push('ticker', { symbol: item.symbol })}
      onToggleSelect={() => app.toggleSelected(item.symbol)}
      showSector
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <Header title="Search" nav={nav} />

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={[styles.field, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={{ color: t.textFaint, fontSize: 16, marginRight: 8 }}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${manifest.counts.universe} securities`}
            placeholderTextColor={t.textFaint}
            autoCorrect={false}
            autoCapitalize="characters"
            style={{ flex: 1, color: t.text, fontSize: 17, paddingVertical: 0 }}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Text style={{ color: t.textFaint, fontSize: 17 }}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {!showing ? (
        <View style={{ flex: 1 }}>
          <View style={{ marginTop: 16 }}>
            <SectionTitle>Jump to a sector</SectionTitle>
            <ChipRow>
              {SECTORS.map((s) => (
                <Chip key={s} label={s} onPress={() => nav.push('group', { kind: 'sector', key: s })} />
              ))}
            </ChipRow>
          </View>

          {recentRows.length > 0 ? (
            <>
              <SectionTitle>Recently viewed</SectionTitle>
              <Card style={{ marginHorizontal: 16 }} padded={false}>
                {recentRows.map((r, i) => (
                  <View key={r.symbol}>
                    {i > 0 ? <Divider inset={64} /> : null}
                    {renderRow(r)}
                  </View>
                ))}
              </Card>
            </>
          ) : (
            <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
              <Text style={{ color: t.textMuted, fontSize: t.font.body, lineHeight: 22 }}>
                Type a ticker like AAPL, a company name, or an industry such as “semiconductors”.
              </Text>
            </View>
          )}
        </View>
      ) : results.length === 0 ? (
        <EmptyState
          title="No match"
          body={`Nothing in the ${manifest.counts.universe}-security universe matches “${query}”. The universe covers the largest, most liquid US names in each sector.`}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => r.symbol}
          renderItem={({ item }) => renderRow(item)}
          ItemSeparatorComponent={() => <Divider inset={64} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    height: 46,
  },
});
