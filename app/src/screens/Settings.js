// Appearance and saved data.

import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import Header from '../components/Header';
import { Card, SectionTitle, Segmented, Divider, StatRow, Button } from '../components/ui';
import { useTheme } from '../theme';
import { useAppState } from '../state';
import { clearAll } from '../store';
import { manifest } from '../data';
import { mediumDate, relativeTime } from '../format';

export default function Settings({ nav }) {
  const { t, mode, setMode } = useTheme();
  const app = useAppState();

  const confirmReset = () => {
    Alert.alert(
      'Clear saved data?',
      'This removes your selection, weights, hidden stocks and preferences from this device. The market data itself is unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            app.clearSelected();
            app.clearHidden();
            app.resetFilters();
            app.resetWeights();
            app.clearRecent();
            app.setPortfolioValue(10000);
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Settings" nav={nav} />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SectionTitle>Appearance</SectionTitle>
        <View style={{ paddingHorizontal: 16 }}>
          <Segmented
            options={[
              { label: 'System', value: 'system' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 17 }}>
            System follows your phone&apos;s appearance setting and switches automatically.
          </Text>
        </View>

        <SectionTitle>Saved on this device</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="Selected stocks" value={String(app.selected.length)} />
          <Divider />
          <StatRow label="Hidden from rankings" value={String(app.hidden.length)} />
          <Divider />
          <StatRow label="Custom weights" value={String(Object.keys(app.weights).length)} />
          <Divider />
          <StatRow label="Recently viewed" value={String(app.recent.length)} />
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 17 }}>
            Your selection, weights and filters are stored on this device and restored the next time you open
            the app.
          </Text>
        </Card>

        <SectionTitle>Dataset</SectionTitle>
        <Card style={styles.card}>
          <StatRow label="Securities" value={String(manifest.counts.universe)} />
          <Divider />
          <StatRow label="Sectors" value={String(manifest.counts.sectors)} />
          <Divider />
          <StatRow label="Industries ranked" value={String(manifest.counts.industriesTagged)} />
          <Divider />
          <StatRow label="Trading date" value={mediumDate(manifest.tradingDate)} mono={false} />
          <Divider />
          <StatRow label="Built" value={relativeTime(manifest.builtAt)} mono={false} />
          <Divider />
          <StatRow label="Provider" value={manifest.provider} mono={false} />
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 10, lineHeight: 17 }}>
            Market data ships with the app, so the screens work offline and no request is made while you
            browse. Refreshing the data means re-running the pipeline and publishing a new build.
          </Text>
        </Card>

        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Button label="Methodology" tone="ghost" onPress={() => nav.push('methodology')} />
          <View style={{ height: 10 }} />
          <Button label="Clear saved data" tone="danger" onPress={confirmReset} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16 },
});
