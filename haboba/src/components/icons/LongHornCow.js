import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * South Sudanese long-horned cattle silhouette.
 * Inspired by the Ankole-Watusi / Dinka cattle — a cultural icon.
 * Dramatic wide-sweeping horns, strong profile.
 */
function LongHornCow({ size = 120, color = '#FFFFFF', style }) {
  const w = size;
  const h = size * 0.65;
  return (
    <Svg width={w} height={h} viewBox="0 0 200 130" style={style}>
      {/* Left horn — long sweeping curve */}
      <Path
        d="M 62,68 Q 40,30 10,12 Q 6,10 8,14 Q 34,35 56,65"
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* Right horn — long sweeping curve */}
      <Path
        d="M 108,68 Q 130,30 160,12 Q 164,10 162,14 Q 136,35 114,65"
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* Horn tips — small accent dots */}
      <Circle cx="9" cy="12" r="2.5" fill={color} />
      <Circle cx="161" cy="12" r="2.5" fill={color} />
      {/* Head — front view, simplified */}
      <Path
        d="M 72,62 Q 70,55 74,50 Q 80,44 85,44 Q 90,44 95,50 Q 100,55 98,62 L 98,80 Q 97,88 92,92 Q 87,96 85,96 Q 83,96 78,92 Q 73,88 72,80 Z"
        fill={color}
        opacity={0.9}
      />
      {/* Ears */}
      <Path
        d="M 68,58 Q 60,52 58,56 Q 60,62 68,64"
        fill={color}
        opacity={0.7}
      />
      <Path
        d="M 102,58 Q 110,52 112,56 Q 110,62 102,64"
        fill={color}
        opacity={0.7}
      />
      {/* Nostrils */}
      <Circle cx="80" cy="82" r="2" fill="#060606" opacity={0.5} />
      <Circle cx="90" cy="82" r="2" fill="#060606" opacity={0.5} />
      {/* Eyes */}
      <Circle cx="78" cy="62" r="2" fill="#060606" opacity={0.6} />
      <Circle cx="92" cy="62" r="2" fill="#060606" opacity={0.6} />
      {/* Body silhouette — simplified, below head */}
      <Path
        d="M 55,96 Q 50,100 48,110 Q 47,118 52,122 L 58,122 L 60,112 Q 62,108 70,104 L 85,100 L 100,104 Q 108,108 110,112 L 112,122 L 118,122 Q 123,118 122,110 Q 120,100 115,96 Q 100,88 85,88 Q 70,88 55,96 Z"
        fill={color}
        opacity={0.6}
      />
      {/* Front legs — simple lines */}
      <Path d="M 60,118 L 60,130" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <Path d="M 70,118 L 70,128" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
      <Path d="M 100,118 L 100,128" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
      <Path d="M 110,118 L 110,130" stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

export default React.memo(LongHornCow);
