import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiCommunity({ size = 24, color = '#000', filled = false, style }) {
  const fill = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Center person */}
      <Path
        d="M12 4c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3z"
        fill={fill}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 13c-3.3 0-6 1.8-6 4v1.5h12V17c0-2.2-2.7-4-6-4z"
        fill={fill}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left person (smaller, behind) */}
      <Path
        d="M5.5 7.5c1 0 1.8.8 1.8 1.8S6.5 11.1 5.5 11.1s-1.8-.8-1.8-1.8.8-1.8 1.8-1.8z"
        fill={fill}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2.5 15.5c0-1.4 1.3-2.5 3-2.5.6 0 1.1.1 1.6.3"
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right person (smaller, behind) */}
      <Path
        d="M18.5 7.5c-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8 1.8-.8 1.8-1.8-.8-1.8-1.8-1.8z"
        fill={fill}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21.5 15.5c0-1.4-1.3-2.5-3-2.5-.6 0-1.1.1-1.6.3"
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiCommunity);
