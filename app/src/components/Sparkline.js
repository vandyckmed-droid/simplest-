// Tiny trend line for list rows. No axes, no touch - just the shape.

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { isNum } from '../analytics/stats';

export default function Sparkline({ values = [], width = 64, height = 24, color, strokeWidth = 1.6 }) {
  const clean = values.filter(isNum);
  if (clean.length < 2) return <Svg width={width} height={height} />;

  let lo = Infinity;
  let hi = -Infinity;
  for (const v of clean) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) {
    hi += 1;
    lo -= 1;
  }

  const n = values.length;
  const pad = 2;
  const innerH = height - pad * 2;
  let d = '';
  values.forEach((v, i) => {
    if (!isNum(v)) return;
    const x = (i / (n - 1)) * width;
    const y = pad + innerH - ((v - lo) / (hi - lo)) * innerH;
    d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
