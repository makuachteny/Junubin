import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiUndo({ size = 24, color = '#000', style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path
        d="M4 9.5l4.5-4.2c.2-.2.1-.5-.2-.5H5.8C7.5 3.2 9.8 2.2 12.5 2.2c5 0 9 4 9 9s-4 9-9 9c-3.2 0-6-1.7-7.6-4.2"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 9.5h4.3c.3 0 .4-.3.2-.5L4 4.8"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiUndo);
