import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

function GraffitiShare({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Three connected nodes — unique share icon */}
      <Circle cx="18" cy="5" r={filled ? 3 : 2.5} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6} />
      <Circle cx="6" cy="12" r={filled ? 3 : 2.5} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6} />
      <Circle cx="18" cy="19" r={filled ? 3 : 2.5} fill={filled ? color : 'none'} stroke={color} strokeWidth={1.6} />
      <Path
        d="M8.4 10.8l7.2-4.6M8.4 13.2l7.2 4.6"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiShare);
