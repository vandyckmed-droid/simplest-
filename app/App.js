// Momentum Desk - phone-first momentum, sector and portfolio-risk app.
//
// A deliberately small navigation shell: four tabs, each with its own stack.
// Keeping navigation in-house avoids a heavyweight dependency and keeps the app
// loading reliably inside Expo Go and Snack.

import React, { useCallback, useMemo, useState } from 'react';
import { BackHandler, Platform, Pressable, SafeAreaView, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './src/theme';
import { AppStateProvider, useAppState } from './src/state';
import { Loading } from './src/components/ui';

import Overview from './src/screens/Overview';
import Rankings from './src/screens/Rankings';
import Sectors from './src/screens/Sectors';
import Portfolio from './src/screens/Portfolio';
import Ticker from './src/screens/Ticker';
import GroupDetail from './src/screens/GroupDetail';
import Compare from './src/screens/Compare';
import Search from './src/screens/Search';
import Methodology from './src/screens/Methodology';
import Settings from './src/screens/Settings';

const TABS = [
  { key: 'overview', label: 'Overview', glyph: '◎' },
  { key: 'rankings', label: 'Rankings', glyph: '≡' },
  { key: 'sectors', label: 'Sectors', glyph: '◫' },
  { key: 'portfolio', label: 'Basket', glyph: '◑' },
];

const SCREENS = {
  overview: Overview,
  rankings: Rankings,
  sectors: Sectors,
  portfolio: Portfolio,
  ticker: Ticker,
  group: GroupDetail,
  compare: Compare,
  search: Search,
  methodology: Methodology,
  settings: Settings,
};

function Shell() {
  const { t } = useTheme();
  const { ready } = useAppState();
  const [tab, setTab] = useState('overview');
  const [stacks, setStacks] = useState({ overview: [], rankings: [], sectors: [], portfolio: [] });

  const stack = stacks[tab] || [];
  const current = stack.length ? stack[stack.length - 1] : { name: tab, params: {} };

  const push = useCallback(
    (name, params = {}) => {
      setStacks((prev) => ({ ...prev, [tab]: [...(prev[tab] || []), { name, params }] }));
    },
    [tab]
  );

  const pop = useCallback(() => {
    setStacks((prev) => {
      const s = prev[tab] || [];
      if (s.length === 0) return prev;
      return { ...prev, [tab]: s.slice(0, -1) };
    });
  }, [tab]);

  const switchTab = useCallback(
    (key) => {
      // Tapping the active tab returns it to its root, which is the behaviour
      // people expect from a tab bar.
      if (key === tab && (stacks[key] || []).length > 0) {
        setStacks((prev) => ({ ...prev, [key]: [] }));
      }
      setTab(key);
    },
    [tab, stacks]
  );

  React.useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 0) {
        pop();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, pop]);

  const nav = useMemo(
    () => ({ push, pop, switchTab, canGoBack: stack.length > 0, depth: stack.length }),
    [push, pop, switchTab, stack.length]
  );

  const ScreenComponent = SCREENS[current.name] || Overview;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.name === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight || 0 : 0 }}>
        {!ready ? (
          <Loading />
        ) : (
          <ScreenComponent nav={nav} params={current.params || {}} />
        )}
      </SafeAreaView>

      <View
        style={[
          styles.tabBar,
          { backgroundColor: t.bgElevated, borderTopColor: t.border, paddingBottom: Platform.OS === 'ios' ? 22 : 10 },
        ]}
      >
        {TABS.map((tb) => {
          const active = tb.key === tab;
          return (
            <Pressable key={tb.key} onPress={() => switchTab(tb.key)} style={styles.tabItem} hitSlop={6}>
              <Text style={{ fontSize: 19, color: active ? t.accent : t.textFaint, marginBottom: 2 }}>
                {tb.glyph}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: active ? '700' : '500',
                  color: active ? t.accent : t.textFaint,
                }}
              >
                {tb.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
  },
  tabItem: { flex: 1, alignItems: 'center' },
});
