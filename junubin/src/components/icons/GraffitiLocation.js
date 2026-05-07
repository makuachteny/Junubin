import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

function GraffitiLocation({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {filled ? (
        <>
          <Path
            d="M12 2.5c-4.2.1-7.3 3.5-7 7.8.3 4.8 6.2 10.5 6.8 11.1.1.1.2.1.4 0 .6-.6 6.5-6.3 6.8-11.1.3-4.3-2.8-7.7-7-7.8z"
            fill={color}
            stroke={color}
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="10" r="2.8" fill={filled ? '#FFF' : 'none'} stroke={filled ? '#FFF' : color} strokeWidth={1.5} />
        </>
      ) : (
        <>
          <Path
            d="M12 2.5c-4.2.1-7.3 3.5-7 7.8.3 4.8 6.2 10.5 6.8 11.1.1.1.2.1.4 0 .6-.6 6.5-6.3 6.8-11.1.3-4.3-2.8-7.7-7-7.8z"
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx="12" cy="10" r="2.8" fill="none" stroke={color} strokeWidth={1.5} />
        </>
      )}
    </Svg>
  );
}

export default React.memo(GraffitiLocation);
