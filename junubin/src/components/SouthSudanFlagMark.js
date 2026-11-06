import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';

export default function SouthSudanFlagMark({
  width = 24,
  height = 16,
  style,
}) {
  const stripe = height / 5;
  const triangleWidth = width * 0.48;
  const starRadius = height * 0.16;
  const cx = width * 0.17;
  const cy = height / 2;

  const starPoints = Array.from({ length: 10 }, (_, i) => {
    const angle = (-90 + i * 36) * (Math.PI / 180);
    const radius = i % 2 === 0 ? starRadius : starRadius * 0.42;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(' ');

  return (
    <View
      style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect x="0" y="0" width={width} height={height} fill="#FFFFFF" />
        <Rect x="0" y="0" width={width} height={stripe} fill="#101820" />
        <Rect x="0" y={stripe * 2} width={width} height={stripe} fill="#DA121A" />
        <Rect x="0" y={stripe * 4} width={width} height={stripe} fill="#078930" />
        <Path d={`M 0 0 L ${triangleWidth} ${height / 2} L 0 ${height} Z`} fill="#0F47AF" />
        <Polygon points={starPoints} fill="#FCDD09" />
      </Svg>
    </View>
  );
}
