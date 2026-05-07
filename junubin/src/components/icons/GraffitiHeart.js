import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiHeart({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {filled ? (
        <Path
          d="M12 21.2c-.4 0-.7-.1-1-.4C9.5 19.5 3 14.2 3 8.8 3 5.6 5.4 3 8.5 3c1.7 0 3.2.9 3.5 1.2.3-.3 1.8-1.2 3.5-1.2C18.6 3 21 5.6 21 8.8c0 5.4-6.5 10.7-8 12-.3.3-.6.4-1 .4z"
          fill={color}
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M12.1 20.8s-8.5-5.2-8.8-11.3C3 5.8 5.5 3.2 8.4 3.2c1.8.1 3.1 1.1 3.7 1.6.6-.5 1.9-1.5 3.7-1.6 2.9 0 5.4 2.6 5.1 6.3-.3 6.1-8.8 11.3-8.8 11.3z"
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

export default React.memo(GraffitiHeart);
