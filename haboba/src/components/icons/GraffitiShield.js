import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiShield({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Shield body — hand-drawn wobbly edges */}
      <Path
        d="M12 2.2c-2.5 1.2-5.2 2-8 2.2-.2 0-.4.2-.4.4.1 4.2.8 7.8 2.5 10.5 1.8 2.8 4.5 4.8 5.7 5.5.1.1.3.1.4 0 1.2-.7 3.9-2.7 5.7-5.5 1.7-2.7 2.4-6.3 2.5-10.5 0-.2-.2-.4-.4-.4-2.8-.2-5.5-1-8-2.2z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner cross — South Sudan star motif */}
      <Path
        d="M12 7.5v5M9.5 10h5"
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Small star at center */}
      <Path
        d="M12 9l.4.8.9.1-.7.6.2.9-.8-.5-.8.5.2-.9-.7-.6.9-.1z"
        fill={filled ? '#FFFFFF' : color}
        stroke="none"
      />
    </Svg>
  );
}

export default React.memo(GraffitiShield);
