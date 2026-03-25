// AnaJunubin — Flag Background
// Subtle South Sudan flag-inspired gradient background.
// Five horizontal bands (Black → Red → White → Green → Blue)
// rendered at very low opacity so content remains readable.
// Wrap any screen's root View to give it the flag tint.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

const LIGHT_COLORS = [
  'rgba(26, 26, 26, 0.04)',      // Black band
  'rgba(206, 17, 38, 0.045)',     // Red band
  'rgba(252, 205, 18, 0.03)',     // Gold transition
  'rgba(255, 255, 255, 0.0)',     // White center
  'rgba(0, 151, 57, 0.04)',       // Green band
  'rgba(0, 71, 171, 0.05)',       // Blue band
];

const DARK_COLORS = [
  'rgba(206, 17, 38, 0.06)',      // Red tint at top
  'rgba(252, 205, 18, 0.03)',     // Gold transition
  'rgba(0, 0, 0, 0.0)',           // Black center
  'rgba(0, 0, 0, 0.0)',           // Black center
  'rgba(0, 151, 57, 0.05)',       // Green band
  'rgba(0, 71, 171, 0.07)',       // Blue band
];

const LOCATIONS = [0, 0.18, 0.35, 0.5, 0.75, 1];

export default function FlagBackground({ children, style }) {
  const { isDark } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={isDark ? DARK_COLORS : LIGHT_COLORS}
        locations={LOCATIONS}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
