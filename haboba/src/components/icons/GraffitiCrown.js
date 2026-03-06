import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';

function GraffitiCrown({ size = 24, color = '#FFD700', filled = false, style }) {
  const id = `crownGrad_${size}`;
  const id2 = `crownShine_${size}`;

  if (!filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
        <Path
          d="M2.5 17.5h19L23 7.5l-5 4.5-5.5-7.5h-1L6 12 1 7.5l1.5 10z"
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M2.5 17.5c0 1.1.9 2.2 2 2.5 1 .3 3.5.5 7.5.5s6.5-.2 7.5-.5c1.1-.3 2-1.4 2-2.5"
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFE44D" />
          <Stop offset="0.35" stopColor="#FFD700" />
          <Stop offset="0.65" stopColor="#F5A623" />
          <Stop offset="1" stopColor="#D4880F" />
        </LinearGradient>
        <LinearGradient id={id2} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.6" />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Crown body — main shape */}
      <Path
        d="M2 17h20L23.5 6.8c.08-.35-.25-.6-.5-.4L18.2 11 12.8 3.4c-.15-.22-.45-.22-.6 0L6.8 11 1 6.4c-.25-.2-.58.05-.5.4L2 17z"
        fill={`url(#${id})`}
      />

      {/* Crown base band */}
      <Path
        d="M2 17c0 1.2 1 2.3 2.2 2.6 1 .3 3.5.4 7.8.4s6.8-.1 7.8-.4C21 19.3 22 18.2 22 17H2z"
        fill={`url(#${id})`}
      />

      {/* Glossy highlight on body */}
      <Path
        d="M3.5 16.5h17L22 8.5 18 11l-5-6.5h-2L6 11 2 8.5l1.5 8z"
        fill={`url(#${id2})`}
      />

      {/* Crown rim line for depth */}
      <Path
        d="M2 17h20"
        stroke="#D4880F"
        strokeWidth={0.6}
        strokeOpacity={0.5}
      />

      {/* Jewel dots on crown tips */}
      <Circle cx="12" cy="4.2" r="1.1" fill="#FFFFFF" opacity={0.85} />
      <Circle cx="6.2" cy="10.2" r="0.9" fill="#FFFFFF" opacity={0.7} />
      <Circle cx="17.8" cy="10.2" r="0.9" fill="#FFFFFF" opacity={0.7} />

      {/* Band jewels */}
      <Circle cx="8" cy="18.2" r="0.8" fill="#E8383B" opacity={0.85} />
      <Circle cx="12" cy="18.2" r="0.8" fill="#3B82F6" opacity={0.85} />
      <Circle cx="16" cy="18.2" r="0.8" fill="#22C55E" opacity={0.85} />

      {/* Outer stroke for crispness */}
      <Path
        d="M2 17h20L23.5 6.8c.08-.35-.25-.6-.5-.4L18.2 11 12.8 3.4c-.15-.22-.45-.22-.6 0L6.8 11 1 6.4c-.25-.2-.58.05-.5.4L2 17z"
        fill="none"
        stroke="#B8860B"
        strokeWidth={0.4}
        strokeOpacity={0.4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiCrown);
