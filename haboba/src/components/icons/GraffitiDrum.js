import React from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';

function GraffitiDrum({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Drum body */}
      <Path
        d="M5.5 8v8c0 .5.3 1 .8 1.3 1.5.9 3.4 1.4 5.7 1.4s4.2-.5 5.7-1.4c.5-.3.8-.8.8-1.3V8"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Drum top */}
      <Ellipse
        cx="12"
        cy="8"
        rx="6.5"
        ry="3"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Zigzag pattern on drum body */}
      <Path
        d="M6.5 12l1.5-1.5L9.5 12l1.5-1.5L12.5 12l1.5-1.5L15.5 12l1.5-1.5L18.5 12"
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      {/* Drumsticks */}
      <Path
        d="M8 4l-2 3.5M16 4l2 3.5"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiDrum);
