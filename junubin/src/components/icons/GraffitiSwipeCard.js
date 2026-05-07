import React from 'react';
import Svg, { Path, Rect, G } from 'react-native-svg';

// Swipe-deck glyph — the front card sits slightly tilted (like a card mid-
// swipe), a back card shows behind it (the next profile waiting to come up),
// and short motion lines on either side imply left/right swipe direction.
function GraffitiSwipeCard({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Back card — slightly behind, lighter */}
      <Rect
        x="6"
        y="5.5"
        width="11"
        height="14.5"
        rx="2"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.6}
        opacity={filled ? 0.35 : 0.55}
      />

      {/* Front card — tilted right ~10° to suggest active swipe */}
      <G transform="rotate(8 12 13)">
        <Rect
          x="7"
          y="5"
          width="11"
          height="14.5"
          rx="2"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? 0 : 1.8}
          strokeLinejoin="round"
        />
      </G>

      {/* Motion line — left side (swipe left/pass) */}
      <Path
        d="M3 11.5 L1.5 11.5"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M3.5 14 L2.2 14"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.6}
      />

      {/* Motion line — right side (swipe right/like) */}
      <Path
        d="M21 11.5 L22.5 11.5"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M20.5 14 L21.8 14"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.6}
      />
    </Svg>
  );
}

export default React.memo(GraffitiSwipeCard);
