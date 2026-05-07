import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

// Friendly waving-hand glyph — used in Social mode to "say hi" to a profile.
// Hand-drawn fingers + small motion arcs above to suggest a wave gesture.
function GraffitiWave({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {/* Motion arcs above the hand (the "hi" wave lines) */}
      <Path
        d="M6.5 4 C7.6 3 9 3 10 4"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M11.5 2.5 C13 1.5 14.8 1.6 16 2.7"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />

      {/* Hand silhouette */}
      <Path
        d="M9 21 C7.4 19.6 6.5 17.7 6.5 15.6 L6.5 11.5 C6.5 10.7 7.1 10.1 7.9 10.1 C8.7 10.1 9.3 10.7 9.3 11.5 L9.3 13 L9.3 8.5 C9.3 7.6 10 7 10.8 7 C11.6 7 12.3 7.6 12.3 8.5 L12.3 12.8 L12.3 7 C12.3 6.1 13 5.5 13.8 5.5 C14.6 5.5 15.3 6.1 15.3 7 L15.3 13 L15.3 9 C15.3 8.2 16 7.6 16.7 7.6 C17.5 7.6 18.2 8.2 18.2 9 L18.2 15.6 C18.2 17.7 17.3 19.6 15.7 21 Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 1.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Tiny dot for the "hi" sparkle */}
      <Circle cx="19.5" cy="5" r="0.9" fill={color} />
    </Svg>
  );
}

export default React.memo(GraffitiWave);
