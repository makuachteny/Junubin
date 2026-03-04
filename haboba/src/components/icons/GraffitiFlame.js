import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiFlame({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M12.5 2.2c.8 2.5 2.5 4.5 3.8 6.5 1.5 2.3 2.2 5 1 7.5-1.5 3.2-5.5 4.8-8.8 3.5-3.2-1.3-4.8-5-3.2-8.2.5-1 1.2-1.8 1.8-2.8.1-.1.3-.1.3.1-.2 1.2 0 2.5.6 3.5.1.2.4.1.4-.1.2-2.2.8-4.3 2-6.2.9-1.5 1.5-3 2.1-3.8z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiFlame);
