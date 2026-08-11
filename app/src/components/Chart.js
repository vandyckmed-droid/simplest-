// Line chart built for a phone screen.
//
// Design rules this component enforces:
//  - never wider than the screen, so nothing needs horizontal scrolling
//  - gaps in the data break the line instead of drawing a false straight run
//  - one touch scrubs the whole chart and reports the date under your finger
//  - axis labels stay sparse; the numbers on the card carry the detail

import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import { isNum } from '../analytics/stats';
import { monthYear, shortDate } from '../format';

const PAD_L = 6;
const PAD_R = 52;
const PAD_T = 10;
const PAD_B = 22;

function buildSegments(values, xOf, yOf) {
  const segments = [];
  let current = '';
  values.forEach((v, i) => {
    if (!isNum(v)) {
      if (current) segments.push(current);
      current = '';
      return;
    }
    const cmd = current ? 'L' : 'M';
    current += `${cmd}${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)}`;
  });
  if (current) segments.push(current);
  return segments;
}

export default function Chart({
  series = [],
  dates = [],
  height = 200,
  width,
  showAxis = true,
  showGrid = true,
  fill = true,
  onScrub,
  yFormat,
  baseline = null,
}) {
  const { t } = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(width || 0);
  const [cursor, setCursor] = useState(null);
  const cursorRef = useRef(null);

  const w = width || layoutWidth;
  const innerW = Math.max(1, w - PAD_L - PAD_R);
  const innerH = Math.max(1, height - PAD_T - PAD_B);

  const n = useMemo(
    () => series.reduce((m, s) => Math.max(m, s.values ? s.values.length : 0), 0),
    [series]
  );

  const { min, max } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) {
      for (const v of s.values || []) {
        if (!isNum(v)) continue;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    if (isNum(baseline)) {
      lo = Math.min(lo, baseline);
      hi = Math.max(hi, baseline);
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1 };
    if (lo === hi) return { min: lo - 1, max: hi + 1 };
    const pad = (hi - lo) * 0.08;
    return { min: lo - pad, max: hi + pad };
  }, [series, baseline]);

  const xOf = (i) => PAD_L + (n <= 1 ? 0 : (i / (n - 1)) * innerW);
  const yOf = (v) => PAD_T + innerH - ((v - min) / (max - min)) * innerH;

  const indexFromX = (x) => {
    if (n <= 1) return 0;
    const rel = (x - PAD_L) / innerW;
    return Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1))));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const i = indexFromX(e.nativeEvent.locationX);
          cursorRef.current = i;
          setCursor(i);
          if (onScrub) onScrub(i);
        },
        onPanResponderMove: (e) => {
          const i = indexFromX(e.nativeEvent.locationX);
          if (i !== cursorRef.current) {
            cursorRef.current = i;
            setCursor(i);
            if (onScrub) onScrub(i);
          }
        },
        onPanResponderRelease: () => {
          cursorRef.current = null;
          setCursor(null);
          if (onScrub) onScrub(null);
        },
        onPanResponderTerminate: () => {
          cursorRef.current = null;
          setCursor(null);
          if (onScrub) onScrub(null);
        },
      }),
    [n, innerW, onScrub]
  );

  if (w === 0) {
    return <View style={{ height }} onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)} />;
  }

  const fmt = yFormat || ((v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)));
  const ticks = [max - (max - min) * 0.08, (max + min) / 2, min + (max - min) * 0.08];

  // X labels: first, middle and last, spaced so they never collide.
  const xTicks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  return (
    <View onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}>
      <View {...panResponder.panHandlers}>
        <Svg width={w} height={height}>
          <Defs>
            {series.map((s, si) => (
              <LinearGradient key={`g${si}`} id={`grad${si}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity="0.22" />
                <Stop offset="1" stopColor={s.color} stopOpacity="0" />
              </LinearGradient>
            ))}
          </Defs>

          {showGrid &&
            ticks.map((v, i) => (
              <Line
                key={`grid${i}`}
                x1={PAD_L}
                y1={yOf(v)}
                x2={PAD_L + innerW}
                y2={yOf(v)}
                stroke={t.chartGrid}
                strokeWidth={1}
              />
            ))}

          {isNum(baseline) && (
            <Line
              x1={PAD_L}
              y1={yOf(baseline)}
              x2={PAD_L + innerW}
              y2={yOf(baseline)}
              stroke={t.borderStrong}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}

          {series.map((s, si) => {
            const vals = s.values || [];
            const segs = buildSegments(vals, xOf, yOf);
            const only = series.length === 1;
            // Close the fill under the data's own extent, not the full axis —
            // a series that starts mid-chart must not paint a wedge over the
            // region where it has no observations.
            const firstValid = vals.findIndex(isNum);
            let lastValid = -1;
            for (let i = vals.length - 1; i >= 0; i -= 1) {
              if (isNum(vals[i])) {
                lastValid = i;
                break;
              }
            }
            return (
              <G key={`s${si}`}>
                {fill && only && segs.length === 1 && firstValid >= 0 && (
                  <Path
                    d={`${segs[0]}L${xOf(lastValid).toFixed(2)} ${(PAD_T + innerH).toFixed(2)}L${xOf(firstValid).toFixed(2)} ${(PAD_T + innerH).toFixed(2)}Z`}
                    fill={`url(#grad${si})`}
                  />
                )}
                {segs.map((d, i) => (
                  <Path
                    key={`p${i}`}
                    d={d}
                    stroke={s.color}
                    strokeWidth={s.width || 2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </G>
            );
          })}

          {showAxis &&
            ticks.map((v, i) => (
              <SvgText
                key={`yl${i}`}
                x={PAD_L + innerW + 6}
                y={yOf(v) + 4}
                fontSize="10"
                fill={t.textFaint}
              >
                {fmt(v)}
              </SvgText>
            ))}

          {showAxis &&
            xTicks.map((i, k) => (
              <SvgText
                key={`xl${k}`}
                x={Math.min(Math.max(xOf(i), PAD_L + 14), PAD_L + innerW - 14)}
                y={height - 6}
                fontSize="10"
                fill={t.textFaint}
                textAnchor={k === 0 ? 'start' : k === xTicks.length - 1 ? 'end' : 'middle'}
              >
                {monthYear(dates[i])}
              </SvgText>
            ))}

          {cursor !== null && (
            <G>
              <Line
                x1={xOf(cursor)}
                y1={PAD_T}
                x2={xOf(cursor)}
                y2={PAD_T + innerH}
                stroke={t.textFaint}
                strokeWidth={1}
              />
              {series.map((s, si) => {
                const v = (s.values || [])[cursor];
                if (!isNum(v)) return null;
                return (
                  <Circle
                    key={`c${si}`}
                    cx={xOf(cursor)}
                    cy={yOf(v)}
                    r={4}
                    fill={s.color}
                    stroke={t.bg}
                    strokeWidth={2}
                  />
                );
              })}
            </G>
          )}
        </Svg>
      </View>

      {cursor !== null && (
        <View style={[styles.callout, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
          <Text style={[styles.calloutDate, { color: t.textMuted }]}>{shortDate(dates[cursor])}</Text>
          {series.map((s, si) => {
            const v = (s.values || [])[cursor];
            return (
              <View key={`cv${si}`} style={styles.calloutRow}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <Text style={[styles.calloutLabel, { color: t.textMuted }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={[styles.calloutValue, { color: t.text, fontFamily: t.mono }]}>
                  {isNum(v) ? fmt(v) : 'no data'}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calloutDate: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  calloutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  calloutLabel: { fontSize: 12, flex: 1 },
  calloutValue: { fontSize: 12, fontWeight: '600' },
});
