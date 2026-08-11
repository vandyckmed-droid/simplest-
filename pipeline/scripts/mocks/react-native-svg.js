import React from 'react';

const host = (name) => {
  const C = ({ children, ...props }) => React.createElement(name, props, children);
  C.displayName = name;
  return C;
};

export const Svg = host('Svg');
export const Path = host('Path');
export const Line = host('Line');
export const Circle = host('Circle');
export const Rect = host('Rect');
export const G = host('G');
export const Defs = host('Defs');
export const LinearGradient = host('LinearGradient');
export const Stop = host('Stop');
export const Text = host('SvgText');
export default Svg;
