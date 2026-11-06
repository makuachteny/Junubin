import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiSparkles({ size = 24, color = '#000', filled = false, style }) {
  const fill = filled ? color : 'none';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Main star burst */}
      <Path
        d="M12 2.5c.3 1.8.8 3.5 1.8 5 1 1.4 2.6 2.3 4.4 2.8-1.8.5-3.4 1.4-4.4 2.8-1 1.5-1.5 3.2-1.8 5-.3-1.8-.8-3.5-1.8-5-1-1.4-2.6-2.3-4.4-2.8 1.8-.5 3.4-1.4 4.4-2.8 1-1.5 1.5-3.2 1.8-5z"
        fill={fill}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Small accent burst top-right */}
      <Path
        d="M19 2c.2 1 .5 1.8 1.2 2.5.6.6 1.4 1 2.3 1.2-.9.2-1.7.6-2.3 1.2-.7.7-1 1.5-1.2 2.5-.2-1-.5-1.8-1.2-2.5-.6-.6-1.4-1-2.3-1.2.9-.2 1.7-.6 2.3-1.2.7-.7 1-1.5 1.2-2.5z"
        fill={fill}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tiny accent burst bottom-left */}
      <Path
        d="M5 17c.1.6.3 1.1.7 1.5.4.4.9.6 1.5.7-.6.1-1.1.3-1.5.7-.4.4-.6.9-.7 1.5-.1-.6-.3-1.1-.7-1.5-.4-.4-.9-.6-1.5-.7.6-.1 1.1-.3 1.5-.7.4-.4.6-.9.7-1.5z"
        fill={fill}
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiSparkles);
