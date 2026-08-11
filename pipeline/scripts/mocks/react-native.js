// Minimal React Native stand-ins so the screens can be mounted under
// react-test-renderer in Node. Behaviour is not simulated - the point is to
// prove every component renders, reads real data, and does not throw.

import React from 'react';

const host = (name) => {
  const C = ({ children, ...props }) => React.createElement(name, props, children);
  C.displayName = name;
  return C;
};

export const View = host('View');
export const Text = host('Text');
export const Image = host('Image');
export const Pressable = host('Pressable');
export const TouchableOpacity = host('TouchableOpacity');
export const SafeAreaView = host('SafeAreaView');
export const ActivityIndicator = host('ActivityIndicator');
export const TextInput = host('TextInput');

export const ScrollView = ({ children, ...props }) =>
  React.createElement('ScrollView', props, children);

export const Modal = ({ children, visible, ...props }) =>
  visible === false ? null : React.createElement('Modal', props, children);

// Renders every row, which is exactly what we want a smoke test to do.
export const FlatList = ({ data = [], renderItem, keyExtractor, ItemSeparatorComponent, ...props }) =>
  React.createElement(
    'FlatList',
    props,
    (data || []).map((item, index) =>
      React.createElement(
        React.Fragment,
        { key: keyExtractor ? keyExtractor(item, index) : String(index) },
        renderItem ? renderItem({ item, index }) : null
      )
    )
  );

export const StyleSheet = {
  create: (obj) => obj,
  hairlineWidth: 1,
  flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : s || {}),
};

export const Platform = {
  OS: 'ios',
  select: (o) => (o && (o.ios !== undefined ? o.ios : o.default)),
};

export const Appearance = {
  getColorScheme: () => 'dark',
  addChangeListener: () => ({ remove() {} }),
};

export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
};

export const Linking = { openURL: () => Promise.resolve() };

export const Alert = { alert: () => {} };

export const PanResponder = {
  create: (config) => ({ panHandlers: {}, config }),
};

export const StatusBar = { currentHeight: 24 };

export const Dimensions = { get: () => ({ width: 390, height: 844 }) };

export default {
  View, Text, Image, Pressable, ScrollView, FlatList, Modal, StyleSheet,
  Platform, Appearance, BackHandler, Linking, Alert, PanResponder, StatusBar,
  SafeAreaView, ActivityIndicator, TextInput, Dimensions, TouchableOpacity,
};
