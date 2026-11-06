import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

function GraffitiSmiley({ size = 24, color = '#000', style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Wobbly circle face */}
      <Path
        d="M12 2.5c-2.6-.1-5.2 1-7 2.8-1.8 1.8-2.8 4.2-2.8 6.8.1 2.6 1.1 5 2.9 6.8 1.8 1.8 4.2 2.8 6.8 2.8 2.6 0 5.1-1.1 6.9-2.9 1.8-1.8 2.8-4.2 2.8-6.8 0-2.6-1.1-5-2.9-6.8C16.9 3.5 14.5 2.5 12 2.5z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left eye */}
      <Circle cx="9" cy="10" r="1.3" fill={color} />
      {/* Right eye */}
      <Circle cx="15" cy="10" r="1.3" fill={color} />
      {/* Smile */}
      <Path
        d="M8.5 14.5c.8 1.5 2 2.2 3.5 2.2s2.7-.7 3.5-2.2"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiSmiley);
