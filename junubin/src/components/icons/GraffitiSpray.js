import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

function GraffitiSpray({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Spray can body */}
      <Path
        d="M8 10h8c.6 0 1 .4 1 1v9c0 .6-.4 1-1 1H8c-.6 0-1-.4-1-1v-9c0-.6.4-1 1-1z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Can top / nozzle */}
      <Path
        d="M10 10V8.5c0-.3.2-.5.5-.5h3c.3 0 .5.2.5.5V10"
        fill="none"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
      />
      {/* Spray dots */}
      <Circle cx="12" cy="4" r="0.8" fill={color} opacity={0.8} />
      <Circle cx="14.5" cy="3" r="0.6" fill={color} opacity={0.5} />
      <Circle cx="9.5" cy="3.5" r="0.5" fill={color} opacity={0.4} />
      <Circle cx="11" cy="2" r="0.4" fill={color} opacity={0.3} />
      <Circle cx="13.5" cy="1.5" r="0.35" fill={color} opacity={0.25} />
      <Circle cx="15" cy="5" r="0.4" fill={color} opacity={0.35} />
      <Circle cx="9" cy="5.5" r="0.35" fill={color} opacity={0.3} />
      {/* Can label stripe */}
      <Path
        d="M7 14h10M7 17h10"
        fill="none"
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
        opacity={0.4}
      />
    </Svg>
  );
}

export default React.memo(GraffitiSpray);
