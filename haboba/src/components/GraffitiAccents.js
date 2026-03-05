// AnaJunubin — Graffiti Accent Decorations
// Reusable spray-paint style decorative elements for section dividers,
// card corners, and header embellishments.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

// ─── Spray Paint Splatter ───
// A cluster of paint dots that can accent corners or empty spaces
export function SpraySplatter({ size = 40, color = '#F56040', opacity = 0.15, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" style={style}>
      <G opacity={opacity}>
        <Circle cx="20" cy="20" r="6" fill={color} />
        <Circle cx="12" cy="14" r="3.5" fill={color} />
        <Circle cx="28" cy="12" r="2.5" fill={color} />
        <Circle cx="30" cy="26" r="3" fill={color} />
        <Circle cx="10" cy="28" r="2" fill={color} />
        <Circle cx="24" cy="32" r="1.5" fill={color} />
        <Circle cx="8" cy="20" r="1.5" fill={color} />
        <Circle cx="32" cy="18" r="1.2" fill={color} />
        <Circle cx="16" cy="32" r="1" fill={color} />
        <Circle cx="26" cy="8" r="0.8" fill={color} />
        <Circle cx="34" cy="30" r="0.7" fill={color} />
        <Circle cx="6" cy="10" r="0.6" fill={color} />
      </G>
    </Svg>
  );
}

// ─── Paint Drip ───
// Vertical drip accent for borders and edges
export function PaintDrip({ height = 30, color = '#F56040', opacity = 0.2, style }) {
  const w = height * 0.3;
  return (
    <Svg width={w} height={height} viewBox="0 0 10 30" style={style}>
      <Path
        d="M5 0v20c0 3-1.5 5.5-2.5 7.5-.3.6 0 1.5.8 1.8.4.1.8.1 1.2-.1 1.5-.8 3-3.2 3-6.5V0"
        fill={color}
        opacity={opacity}
      />
    </Svg>
  );
}

// ─── Tribal Zigzag Divider ───
// South Sudanese-inspired geometric pattern divider
export function TribalDivider({ width = 300, height = 12, colors: divColors, style }) {
  const c1 = divColors?.[0] || '#EF4444';
  const c2 = divColors?.[1] || '#22C55E';
  const c3 = divColors?.[2] || '#3B82F6';
  const segW = 20;
  const count = Math.ceil(width / segW);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style}>
      {Array.from({ length: count }).map((_, i) => {
        const x = i * segW;
        const color = [c1, c2, c3][i % 3];
        return (
          <Path
            key={i}
            d={`M${x} ${height / 2}l${segW / 2} ${-height / 2 + 1}l${segW / 2} ${height / 2 - 1}`}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.4}
          />
        );
      })}
    </Svg>
  );
}

// ─── Graffiti Corner Frame ───
// Rough spray-painted corner marks for cards and containers
export function GraffitiCorner({ size = 24, color = '#F56040', position = 'topLeft', style }) {
  const rotate = {
    topLeft: '0',
    topRight: '90',
    bottomRight: '180',
    bottomLeft: '270',
  }[position] || '0';

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={[{ transform: [{ rotate: `${rotate}deg` }] }, style]}
    >
      <Path
        d="M2 12V4c0-1.1.9-2 2-2h8"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
      <Circle cx="4" cy="4" r="1.5" fill={color} opacity={0.3} />
    </Svg>
  );
}

// ─── Spray Dot Row ───
// Horizontal row of fading dots, like spray paint mist
export function SprayDotRow({ width = 200, dotColor = '#F56040', style }) {
  const dots = [];
  const count = Math.floor(width / 8);
  for (let i = 0; i < count; i++) {
    const opacity = 0.1 + Math.random() * 0.25;
    const r = 1 + Math.random() * 1.5;
    const y = 3 + Math.random() * 4;
    dots.push({ cx: 4 + i * 8, cy: y, r, opacity });
  }
  return (
    <Svg width={width} height={10} viewBox={`0 0 ${width} 10`} style={style}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={dotColor} opacity={d.opacity} />
      ))}
    </Svg>
  );
}

// ─── Combined Section Divider ───
// Full-width section divider with tribal zigzag and spray accents
export function GraffitiSectionDivider({ colors: themeColors, style }) {
  const accent = themeColors?.accent || '#F56040';
  return (
    <View style={[dividerStyles.container, style]}>
      <TribalDivider
        width={280}
        height={10}
        colors={['#EF4444', '#22C55E', '#3B82F6']}
      />
      <View style={dividerStyles.dotRow}>
        <SpraySplatter size={16} color={accent} opacity={0.12} />
        <View style={[dividerStyles.line, { backgroundColor: accent }]} />
        <SpraySplatter size={16} color={accent} opacity={0.12} />
      </View>
    </View>
  );
}

const dividerStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 4,
    marginVertical: 8,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  line: {
    height: 1,
    flex: 1,
    opacity: 0.1,
    marginHorizontal: 4,
  },
});
