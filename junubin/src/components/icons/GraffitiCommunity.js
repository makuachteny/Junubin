import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

// Community glyph — globe with latitude + longitude lines.
// Single-silhouette outline so this tab matches the visual weight of the
// other tabs (Likes heart, Connect card, Chats bubble). Replaces the prior
// three-person silhouette in favor of a "global community" reading.
function GraffitiCommunity({ size = 24, color = '#000', filled = false, style }) {
  const fill = filled ? color : 'none';
  // Inner-stroke colour: keep meridians/equator readable when the body is
  // filled (focused tab) by inverting them; outline state uses base color.
  const innerStroke = filled ? '#FFFFFF' : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Globe body */}
      <Circle
        cx="12"
        cy="12"
        r="9"
        fill={fill}
        stroke={color}
        strokeWidth={1.8}
      />
      {/* Equator */}
      <Path
        d="M3 12h18"
        stroke={innerStroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Central meridian */}
      <Path
        d="M12 3v18"
        stroke={innerStroke}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Curved meridian — left lobe (suggests sphere depth) */}
      <Path
        d="M12 3c-3 2.5-4.5 5.5-4.5 9s1.5 6.5 4.5 9"
        fill="none"
        stroke={innerStroke}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Curved meridian — right lobe */}
      <Path
        d="M12 3c3 2.5 4.5 5.5 4.5 9s-1.5 6.5-4.5 9"
        fill="none"
        stroke={innerStroke}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default React.memo(GraffitiCommunity);
