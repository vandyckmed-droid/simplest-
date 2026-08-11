// Screen header: a back affordance, a title, and at most one action.
// Kept short so the content starts high on the screen.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export default function Header({ title, subtitle, nav, action, onAction, large = false }) {
  const { t } = useTheme();
  const canGoBack = nav && nav.canGoBack;

  return (
    <View style={[styles.wrap, { borderBottomColor: t.border }]}>
      <View style={styles.top}>
        {canGoBack ? (
          <Pressable onPress={nav.pop} hitSlop={14} style={styles.back}>
            <Text style={{ color: t.accent, fontSize: 17, fontWeight: '600' }}>‹ Back</Text>
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}

        {!large ? (
          <Text style={[styles.centreTitle, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {action ? (
          <Pressable onPress={onAction} hitSlop={14} style={styles.action}>
            <Text style={{ color: t.accent, fontSize: 15, fontWeight: '600' }}>{action}</Text>
          </Pressable>
        ) : (
          <View style={styles.action} />
        )}
      </View>

      {large ? (
        <View style={styles.largeBlock}>
          <Text style={[styles.largeTitle, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: t.textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : subtitle ? (
        <Text style={[styles.subtitleCentre, { color: t.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  top: { flexDirection: 'row', alignItems: 'center', height: 44, paddingHorizontal: 12 },
  back: { minWidth: 68 },
  action: { minWidth: 68, alignItems: 'flex-end' },
  centreTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  subtitleCentre: { textAlign: 'center', fontSize: 12, marginTop: -4 },
  largeBlock: { paddingHorizontal: 16, paddingTop: 2 },
  largeTitle: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
