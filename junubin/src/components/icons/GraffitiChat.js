import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

// Chat glyph — single rounded speech bubble with three typing dots.
// Single-silhouette outline so this tab matches the visual weight of
// GraffitiCommunity and GraffitiHeart (both single shapes). Replaces the
// previous overlapping two-bubble version which read busy next to them.
function GraffitiChat({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Bubble body with a tail flowing into the bottom-left corner */}
      <Path
        d="M4.5 6.2C4.5 4.7 5.7 3.5 7.2 3.5h9.6c1.5 0 2.7 1.2 2.7 2.7v7c0 1.5-1.2 2.7-2.7 2.7h-6l-3.8 3.2c-.4.3-1 .1-1-.4v-2.8c-1.5 0-2.7-1.2-2.7-2.7V6.2z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* Three typing dots — inverted on filled state */}
      <Circle cx="8.5" cy="9.7" r="1.05" fill={filled ? '#FFFFFF' : color} />
      <Circle cx="12"  cy="9.7" r="1.05" fill={filled ? '#FFFFFF' : color} />
      <Circle cx="15.5" cy="9.7" r="1.05" fill={filled ? '#FFFFFF' : color} />
    </Svg>
  );
}

export default React.memo(GraffitiChat);
