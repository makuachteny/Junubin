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
  xs: 5,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 28,
  xxl: 36,
};

export const Fonts = {
  size: { xs: 12, sm: 13, md: 14, base: 15, lg: 16, xl: 17, '2xl': 19, '3xl': 22, '4xl': 26, '5xl': 30, '6xl': 36 },
  weight: { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900' },
  tracking: { tighter: -0.5, tight: -0.3, normal: 0, wide: 0.3, wider: 0.5, widest: 1 },
  family: FontFamily,
};

export const Typography = {
  // Display
  display: { fontFamily: FontFamily.black, fontSize: 36, fontWeight: '900', lineHeight: 43, letterSpacing: -0.6 },
  // Headings
  h1: { fontFamily: FontFamily.extrabold, fontSize: 32, fontWeight: '800', lineHeight: 39, letterSpacing: -0.4 },
  h2: { fontFamily: FontFamily.bold, fontSize: 26, fontWeight: '700', lineHeight: 32, letterSpacing: -0.3 },
  h3: { fontFamily: FontFamily.bold, fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.15 },
  h4: { fontFamily: FontFamily.semibold, fontSize: 19, fontWeight: '600', lineHeight: 25, letterSpacing: -0.05 },
  // Body
  body: { fontFamily: FontFamily.regular, fontSize: 17, fontWeight: '400', lineHeight: 25, letterSpacing: 0.05 },
  bodyMedium: { fontFamily: FontFamily.medium, fontSize: 17, fontWeight: '500', lineHeight: 25, letterSpacing: 0.05 },
  bodySemibold: { fontFamily: FontFamily.semibold, fontSize: 17, fontWeight: '600', lineHeight: 25, letterSpacing: 0.03 },
  bodySmall: { fontFamily: FontFamily.regular, fontSize: 15, fontWeight: '400', lineHeight: 22, letterSpacing: 0.04 },
  bodySmallMedium: { fontFamily: FontFamily.medium, fontSize: 15, fontWeight: '500', lineHeight: 22, letterSpacing: 0.04 },
  // Caption
  caption: { fontFamily: FontFamily.medium, fontSize: 13, fontWeight: '500', lineHeight: 17, letterSpacing: 0.2 },
  captionBold: { fontFamily: FontFamily.bold, fontSize: 13, fontWeight: '700', lineHeight: 17, letterSpacing: 0.25 },
  // Label
  label: { fontFamily: FontFamily.semibold, fontSize: 14, fontWeight: '600', lineHeight: 18, letterSpacing: 0.45 },
  labelUpper: { fontFamily: FontFamily.bold, fontSize: 13, fontWeight: '700', lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase' },
  // Section
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.05 },
  sectionLabel: { fontFamily: FontFamily.semibold, fontSize: 17, fontWeight: '600', lineHeight: 23, letterSpacing: 0.02 },
  // Screen header
  screenTitle: { fontFamily: FontFamily.bold, fontSize: 23, fontWeight: '700', lineHeight: 29, letterSpacing: -0.25 },
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
  primary: ['#332F2D', '#252220'],
  accent: ['#E8453C', '#C62828'],
  rose: ['#FF80AB', '#F06292'],
  royal: ['#FF7854', '#E64A19'],
  splash: ['#1A1816', '#141210', '#100E0D'],
  card: ['transparent', 'rgba(28, 25, 23, 0.75)'],
};
