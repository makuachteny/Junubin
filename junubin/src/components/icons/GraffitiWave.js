import React from 'react';
import { Ionicons } from '@expo/vector-icons';

// Wave / "say hi" glyph. Wraps the same Ionicons `hand-left` used by
// the Socialize-mode Say-hi action on ProfileViewScreen so the gesture
// is depicted identically across the app. `filled` swaps to the
// outline variant when the user hasn't waved yet (the reaction row
// distinguishes pressed vs unpressed state with that swap).
function GraffitiWave({ size = 24, color = '#000', filled = false, style }) {
  return (
    <Ionicons
      name={filled ? 'hand-left' : 'hand-left-outline'}
      size={size}
      color={color}
      style={style}
    />
  );
}

export default React.memo(GraffitiWave);
