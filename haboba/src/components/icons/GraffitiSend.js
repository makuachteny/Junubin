import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiSend({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M3.2 4.8L21.5 12c.2.1.2.4 0 .5L3.2 19.8c-.3.1-.5-.1-.5-.4l1.5-6.8L15 12l-10.8-.6-1.5-6.2c0-.3.2-.5.5-.4z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiSend);
