// Blueprint — the Industry design language's signature card frame
// (claude.ai/design "JuNubin Redesign").
//
// A square, hairline-bordered box with four "registration mark"
// crosses sitting just outside the corners, like a technical drawing.
// Use it for primary CTAs, feature cards, and anything that should
// read as a deliberate object rather than a soft rounded panel:
//
//   <Blueprint style={{ padding: 14 }}>
//     ...content...
//   </Blueprint>
//
// The frame is deliberately radius-0 — do not pass borderRadius in
// `style`; rounding defeats the registration marks.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const MARK = 11;      // arm length of each corner cross
const OFFSET = -6;    // how far outside the box the cross centre sits

function CornerMark({ position, color }) {
  return (
    <View pointerEvents="none" style={[styles.mark, position]}>
      <View style={[styles.markV, { backgroundColor: color }]} />
      <View style={[styles.markH, { backgroundColor: color }]} />
    </View>
  );
}

export default function Blueprint({ style, children, corners = true, borderColor, markColor }) {
  const { colors, isDark } = useTheme();
  const border = borderColor || colors.separator;
  // Marks are drawn at ~55% text ink, matching the design system's
  // `color-mix(in srgb, var(--color-text) 55%, transparent)`.
  const mark = markColor || (isDark ? 'rgba(236, 238, 241, 0.55)' : 'rgba(29, 31, 32, 0.55)');

  return (
    <View style={[styles.frame, { borderColor: border }, style]}>
      {children}
      {corners && (
        <>
          <CornerMark color={mark} position={{ top: OFFSET, left: OFFSET }} />
          <CornerMark color={mark} position={{ top: OFFSET, right: OFFSET }} />
          <CornerMark color={mark} position={{ bottom: OFFSET, left: OFFSET }} />
          <CornerMark color={mark} position={{ bottom: OFFSET, right: OFFSET }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 0,
    // Marks live outside the border; the frame must not clip them.
    overflow: 'visible',
  },
  mark: {
    position: 'absolute',
    width: MARK,
    height: MARK,
  },
  markV: {
    position: 'absolute',
    left: 5,
    top: 0,
    width: 1,
    height: MARK,
  },
  markH: {
    position: 'absolute',
    top: 5,
    left: 0,
    width: MARK,
    height: 1,
  },
});
