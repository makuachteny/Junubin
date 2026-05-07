import React from 'react';
import Svg, { Path } from 'react-native-svg';

function GraffitiTag({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Graffiti-style "E" tag with drip — represents JuNubin */}
      <Path
        d="M7 4c3.5-.2 6.5-.1 10 0"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 4v8c0 2.5-1 4-3.5 4.5-1.5.3-2.8-.2-3.5-1"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Paint drip from the J */}
      <Path
        d="M12 12v3.5c0 .8-.1 1.8-.2 2.8-.1.8-.1 1.5 0 2"
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.6}
      />
      {/* Small star accent */}
      <Path
        d="M18 8l.6 1.2 1.3.2-1 .9.2 1.3-1.1-.6-1.1.6.2-1.3-1-.9 1.3-.2z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiTag);
