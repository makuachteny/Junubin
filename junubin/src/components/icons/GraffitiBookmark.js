import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiBookmark({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {filled ? (
        <Path
          d="M5.5 3.2h13c.5 0 .8.4.8.8v17.2c0 .4-.5.6-.8.4L12 17.4l-6.5 4.2c-.3.2-.8 0-.8-.4V4c0-.4.3-.8.8-.8z"
          fill={color}
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Path
          d="M5.5 3.2h13c.5 0 .8.4.8.8v17.2c0 .4-.5.6-.8.4L12 17.4l-6.5 4.2c-.3.2-.8 0-.8-.4V4c0-.4.3-.8.8-.8z"
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

export default React.memo(GraffitiBookmark);
