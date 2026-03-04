import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiChat({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {filled ? (
        <>
          <Path
            d="M5.2 3.5c-2.1.3-3.4 2-3.2 4.2.2 2.4 1.1 4.1 3.6 5.2l-1.4 2.8c-.1.2.1.4.3.3l3.6-1.8c.8.2 1.6.2 2.4.1 2.4-.3 4.2-2 4.2-4.6S13 3.1 10.2 3.2c-1.8.1-3.4.1-5 .3z"
            fill={color}
            stroke={color}
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15.5 8.5c-.2 0-.3 0-.5.1.5 1.5.1 3.2-1.1 4.5-1.2 1.3-3 1.9-4.8 1.7-.1 0-.2 0-.2.1 1.2 1.8 3.5 2.8 5.8 2.5.4 0 .7 0 1.1.1l3.2 1.5c.2.1.4-.1.3-.3l-1.2-2.4c2.2-1 3-2.5 3.2-4.5.2-2.2-1-3.8-3-4.1-.9-.2-1.8-.2-2.8-.2z"
            fill={color}
            stroke={color}
            strokeWidth={0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <Path
            d="M5.2 3.5c-2.1.3-3.4 2-3.2 4.2.2 2.4 1.1 4.1 3.6 5.2l-1.4 2.8c-.1.2.1.4.3.3l3.6-1.8c.8.2 1.6.2 2.4.1 2.4-.3 4.2-2 4.2-4.6S13 3.1 10.2 3.2c-1.8.1-3.4.1-5 .3z"
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M15.5 8.5c-.2 0-.3 0-.5.1.5 1.5.1 3.2-1.1 4.5-1.2 1.3-3 1.9-4.8 1.7-.1 0-.2 0-.2.1 1.2 1.8 3.5 2.8 5.8 2.5.4 0 .7 0 1.1.1l3.2 1.5c.2.1.4-.1.3-.3l-1.2-2.4c2.2-1 3-2.5 3.2-4.5.2-2.2-1-3.8-3-4.1-.9-.2-1.8-.2-2.8-.2z"
            fill="none"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </Svg>
  );
}

export default React.memo(GraffitiChat);
