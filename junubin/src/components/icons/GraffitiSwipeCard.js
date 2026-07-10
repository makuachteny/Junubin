import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// Swipe-deck glyph — single rounded card with a heart inside.
// Single-silhouette outline to match the visual weight of GraffitiCommunity
// and GraffitiHeart (which are also single-shape silhouettes), so the four
// tab icons read as one family.
function GraffitiSwipeCard({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Card frame */}
      <Rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="3"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {/* Centered heart — inverted color on filled state so it stays visible */}
      <Path
        d="M12 16.2s-4-2.4-4-5.3c0-1.6 1.2-2.7 2.6-2.7.8 0 1.4.4 1.7.8.3-.4.9-.8 1.7-.8 1.4 0 2.6 1.1 2.6 2.7 0 2.9-4 5.3-4 5.3z"
        fill={filled ? '#FFFFFF' : 'none'}
        stroke={filled ? '#FFFFFF' : color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiSwipeCard);
