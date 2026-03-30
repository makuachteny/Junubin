import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiRepost({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M17.5 3.5l3 3-3 3M6.5 17.5l-3 3 3 3"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.5 6.5H8.5c-2.2 0-4 1.8-4 4v1M3.5 20.5h12c2.2 0 4-1.8 4-4v-1"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiRepost);
