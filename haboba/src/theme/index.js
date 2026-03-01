// AnaJunubin — Unified Theme
// Romantic Core (Red · Pink · Gray) + Energetic Accents (Orange · Gold · Green)
// Crown-themed, culturally rooted
// Primary typeface: DM Sans

import { LightPalette, DarkPalette } from './palettes';
import { ThemeProvider, useTheme } from './ThemeContext';
import { FontFamily, fontForWeight, fontAssets } from './fonts';
import { getShadow } from './shadows';
import { wp, hp, ms, clamp, isSmallScreen, isLargeScreen, SCREEN_WIDTH, SCREEN_HEIGHT } from './responsive';

// Backward compat — static Colors for components that always render on dark surfaces (ProfileCard)
const Colors = LightPalette;

export { LightPalette, DarkPalette, ThemeProvider, useTheme, Colors, FontFamily, fontForWeight, fontAssets, getShadow };
export { wp, hp, ms, clamp, isSmallScreen, isLargeScreen, SCREEN_WIDTH, SCREEN_HEIGHT };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Fonts = {
  size: { xs: 11, sm: 12, md: 13, base: 14, lg: 15, xl: 16, '2xl': 18, '3xl': 20, '4xl': 24, '5xl': 28, '6xl': 34 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900' },
  tracking: { tighter: -0.5, tight: -0.3, normal: 0, wide: 0.3, wider: 0.5, widest: 1 },
  family: FontFamily,
};

export const Typography = {
  // Display
  display: { fontFamily: FontFamily.black, fontSize: 34, fontWeight: '900', lineHeight: 40, letterSpacing: -0.6 },
  // Headings
  h1: { fontFamily: FontFamily.extrabold, fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.4 },
  h2: { fontFamily: FontFamily.bold, fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3 },
  h3: { fontFamily: FontFamily.bold, fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.15 },
  h4: { fontFamily: FontFamily.semibold, fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: -0.05 },
  // Body
  body: { fontFamily: FontFamily.regular, fontSize: 16, fontWeight: '400', lineHeight: 23, letterSpacing: 0.05 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: 16, fontWeight: '500', lineHeight: 23, letterSpacing: 0.05 },
  bodySemibold: { fontFamily: FontFamily.semibold, fontSize: 16, fontWeight: '600', lineHeight: 23, letterSpacing: 0.03 },
  bodySmall: { fontFamily: FontFamily.regular, fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: 0.04 },
  bodySmallMedium: { fontFamily: FontFamily.medium, fontSize: 14, fontWeight: '500', lineHeight: 20, letterSpacing: 0.04 },
  // Caption
  caption: { fontFamily: FontFamily.medium, fontSize: 12, fontWeight: '500', lineHeight: 15, letterSpacing: 0.2 },
  captionBold: { fontFamily: FontFamily.bold, fontSize: 12, fontWeight: '700', lineHeight: 15, letterSpacing: 0.25 },
  // Label
  label: { fontFamily: FontFamily.semibold, fontSize: 13, fontWeight: '600', lineHeight: 16, letterSpacing: 0.45 },
  labelUpper: { fontFamily: FontFamily.bold, fontSize: 12, fontWeight: '700', lineHeight: 15, letterSpacing: 0.9, textTransform: 'uppercase' },
  // Section
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: 18, fontWeight: '700', lineHeight: 24, letterSpacing: -0.05 },
  sectionLabel: { fontFamily: FontFamily.semibold, fontSize: 16, fontWeight: '600', lineHeight: 21, letterSpacing: 0.02 },
  // Screen header
  screenTitle: { fontFamily: FontFamily.bold, fontSize: 21, fontWeight: '700', lineHeight: 27, letterSpacing: -0.25 },
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  xxl: 28,
  circle: 999,
};

export const Gradients = {
  primary: ['#2D2319', '#1A1008'],
  accent: ['#FF5252', '#D32F2F'],
  rose: ['#FF80AB', '#F06292'],
  royal: ['#FF7854', '#E64A19'],
  splash: ['#1A1612', '#12100D', '#0A0806'],
  card: ['transparent', 'rgba(45, 35, 25, 0.75)'],
};
