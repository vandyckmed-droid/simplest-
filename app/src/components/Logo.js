// Company logo with a graceful fallback.
//
// Logos are a nice-to-have, never a dependency: if the image source is slow,
// blocked or missing, the row still renders with a clean monogram tile. React
// Native's image layer caches the fetched bitmaps, so a scrolled list does not
// re-request them.

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

// A stable colour per symbol, so the same ticker always gets the same tile.
function hueFor(symbol) {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  return h;
}

export default function Logo({ symbol, uri, size = 40, radius }) {
  const { t } = useTheme();
  const [failed, setFailed] = useState(false);
  const r = radius === undefined ? size / 4 : radius;
  const sym = String(symbol || '?');

  if (!uri || failed) {
    const hue = hueFor(sym);
    return (
      <View
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: r,
            backgroundColor: t.name === 'dark' ? `hsl(${hue}, 32%, 22%)` : `hsl(${hue}, 62%, 92%)`,
          },
        ]}
      >
        <Text
          style={{
            color: t.name === 'dark' ? `hsl(${hue}, 70%, 76%)` : `hsl(${hue}, 55%, 32%)`,
            fontSize: size * 0.36,
            fontWeight: '700',
          }}
        >
          {sym.slice(0, 2)}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: t.name === 'dark' ? '#FFFFFF' : t.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border,
        },
      ]}
    >
      <Image
        source={{ uri, cache: 'force-cache' }}
        style={{ width: size * 0.72, height: size * 0.72, borderRadius: 4 }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
