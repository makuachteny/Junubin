import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiCrown({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M3.5 18.5h17l1.8-11.2c.1-.3-.3-.5-.5-.3L18 11.5l-4.5-7.8c-.2-.3-.6-.3-.8 0L8.2 11.5 4.2 7c-.2-.2-.6 0-.5.3L5.5 18.5z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3.5 18.5c-.1.5.2 1.2.8 1.5.5.2 1.2.3 7.7.3s7.2-.1 7.7-.3c.6-.3.9-1 .8-1.5"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiCrown);
