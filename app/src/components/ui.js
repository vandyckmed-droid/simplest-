// Shared interface primitives. Every screen is assembled from these, which is
// what keeps sector, industry and global views speaking the same visual language.

import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Card({ children, style, onPress, padded = true }) {
  const { t } = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: t.bgElevated,
          borderColor: t.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: t.radius.md,
          padding: padded ? 16 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ children, action, onAction }) {
  const { t } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={{ color: t.textMuted, fontSize: t.font.label, fontWeight: '600', letterSpacing: 0.6 }}>
        {String(children).toUpperCase()}
      </Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={{ color: t.accent, fontSize: t.font.label, fontWeight: '600' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({ label, tone = 'neutral', small = false }) {
  const { t } = useTheme();
  const map = {
    neutral: { bg: t.surfaceAlt, fg: t.textMuted },
    up: { bg: t.upSoft, fg: t.up },
    down: { bg: t.downSoft, fg: t.down },
    accent: { bg: t.accentSoft, fg: t.accent },
    warn: { bg: t.warnSoft, fg: t.warn },
  };
  const c = map[tone] || map.neutral;
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: small ? 6 : 8,
        paddingVertical: small ? 2 : 4,
        borderRadius: t.radius.pill,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: c.fg, fontSize: small ? t.font.micro : t.font.label, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

export function Chip({ label, active, onPress, tone }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: t.radius.pill,
        backgroundColor: active ? (tone || t.accent) : t.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? (tone || t.accent) : t.border,
        marginRight: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: active ? '#FFFFFF' : t.textMuted,
          fontSize: t.font.label,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[{ paddingHorizontal: 16 }, style]}
    >
      {children}
    </ScrollView>
  );
}

export function Segmented({ options, value, onChange, style }) {
  const { t } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: t.surface,
          borderRadius: t.radius.sm,
          padding: 3,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: t.radius.sm - 2,
              backgroundColor: active ? t.bgElevated : 'transparent',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: active ? t.text : t.textMuted,
                fontSize: t.font.label,
                fontWeight: active ? '700' : '500',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A label/value line. `hint` is the small grey explanation underneath, used to
// show the inputs behind a metric.
export function StatRow({ label, value, hint, tone, mono = true, onPress }) {
  const { t } = useTheme();
  const content = (
    <View style={styles.statRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ color: t.textMuted, fontSize: t.font.body }}>{label}</Text>
        {hint ? (
          <Text style={{ color: t.textFaint, fontSize: t.font.micro, marginTop: 2 }}>{hint}</Text>
        ) : null}
      </View>
      <Text
        style={{
          color: tone || t.text,
          fontSize: t.font.body,
          fontWeight: '600',
          fontFamily: mono ? t.mono : undefined,
        }}
      >
        {value}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function Divider({ inset = 0 }) {
  const { t } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: inset }} />;
}

export function BigNumber({ value, label, tone, align = 'left' }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Text
        style={{
          color: tone || t.text,
          fontSize: t.font.display,
          fontWeight: '700',
          fontFamily: t.mono,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      {label ? (
        <Text style={{ color: t.textMuted, fontSize: t.font.label, marginTop: 2 }}>{label}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, body, action, onAction }) {
  const { t } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ color: t.text, fontSize: t.font.heading, fontWeight: '600', textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            color: t.textMuted,
            fontSize: t.font.body,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: 20,
            backgroundColor: t.accent,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: t.radius.pill,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: t.font.body }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({ label, onPress, tone = 'accent', style, disabled }) {
  const { t } = useTheme();
  const bg = tone === 'accent' ? t.accent : tone === 'danger' ? t.down : t.surface;
  const fg = tone === 'ghost' ? t.text : '#FFFFFF';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: tone === 'ghost' ? t.surface : bg,
          paddingVertical: 13,
          paddingHorizontal: 18,
          borderRadius: t.radius.sm,
          alignItems: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          borderWidth: tone === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: t.border,
        },
        style,
      ]}
    >
      <Text style={{ color: tone === 'ghost' ? t.text : fg, fontWeight: '700', fontSize: t.font.body }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Loading() {
  const { t } = useTheme();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

// Small caption used under charts and metrics to name the exact inputs used.
export function Inputs({ items }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
      {items.filter(Boolean).map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', marginRight: 12, marginBottom: 4 }}>
          <Text style={{ color: t.textFaint, fontSize: t.font.micro }}>{it.label} </Text>
          <Text style={{ color: t.textMuted, fontSize: t.font.micro, fontWeight: '600' }}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 22,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  empty: { padding: 40, alignItems: 'center', justifyContent: 'center' },
});
