// AnaJunubin — Unified Theme
// South Sudan Flag Blend: Orange accent · Pink rose · Green · Blue · Gold · Red · Black
// Warm sunset orange as primary, pink for likes, flag colors as vibrant accents
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
  bodySmall: { fontFamily: FontFamily.regular, fontSize: 16, fontWeight: '400', lineHeight: 23, letterSpacing: 0.04 },
  bodySmallMedium: { fontFamily: FontFamily.medium, fontSize: 16, fontWeight: '500', lineHeight: 23, letterSpacing: 0.04 },
  // Caption
  caption: { fontFamily: FontFamily.medium, fontSize: 14, fontWeight: '500', lineHeight: 18, letterSpacing: 0.2 },
  captionBold: { fontFamily: FontFamily.bold, fontSize: 14, fontWeight: '700', lineHeight: 18, letterSpacing: 0.25 },
  // Label
  label: { fontFamily: FontFamily.semibold, fontSize: 14, fontWeight: '600', lineHeight: 18, letterSpacing: 0.45 },
  labelUpper: { fontFamily: FontFamily.bold, fontSize: 13, fontWeight: '700', lineHeight: 17, letterSpacing: 0.9, textTransform: 'uppercase' },
  // Section
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.05 },
  sectionLabel: { fontFamily: FontFamily.semibold, fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: 0.02 },
  // Screen header
  screenTitle: { fontFamily: FontFamily.bold, fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.25 },
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 20,
  xxl: 28,
  circle: 999,
};

export const ZIndex = {
  base: 1,
  card: 2,
  actionButtons: 3,
  header: 5,
  tabBar: 10,
  overlay: 50,
  modal: 100,
  toast: 500,
  alert: 1000,
  system: 9999,
};

export const Layout = {
  headerHeight: 60,
  filterGap: 10,
};

export const getSurface = (variant, colors, isDark) => {
  switch (variant) {
    case 'card':
      return {
        backgroundColor: isDark ? colors.gray900 : colors.white,
        borderColor: isDark ? colors.gray800 : colors.gray200,
        borderWidth: 1,
        ...getShadow('md', isDark),
      };
    case 'modal':
      return {
        backgroundColor: isDark ? colors.gray900 : colors.white,
        borderColor: isDark ? colors.gray800 : colors.gray200,
        borderWidth: 1,
        ...getShadow('lg', isDark),
      };
    case 'floating':
      return {
        backgroundColor: isDark ? colors.gray900 : colors.white,
        borderColor: isDark ? colors.gray800 : 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        ...getShadow('sm', isDark),
      };
    default:
      return {
        backgroundColor: isDark ? colors.gray900 : colors.white,
        borderColor: isDark ? colors.gray800 : colors.gray200,
        borderWidth: 1,
        ...getShadow('sm', isDark),
      };
  }
};

export const Gradients = {
  primary: ['#141416', '#0C0C0E'],
  // South Sudan flag gradient — red → green
  accent: ['#CE1126', '#009739'],
  rose: ['#F05AA5', '#E84393'],
  royal: ['#0047AB', '#003580', '#002B66'],
  splash: ['#060608', '#0C0C0E', '#060608'],
  card: ['transparent', 'rgba(0, 0, 0, 0.75)'],
  // South Sudan flag ring gradient (Black → Red → Gold → Green → Blue)
  storyRing: ['#1A1A1A', '#CE1126', '#FCCD12', '#009739', '#0047AB'],
  // Full South Sudan brand gradient
  southSudan: ['#000000', '#CE1126', '#FFFFFF', '#009739', '#0047AB'],
  // Warm action gradient (bright → deep red)
  warm: ['#F04C55', '#CE1126'],
  // Flag ring (vibrant, for rings and borders)
  flagRing: ['#1A1A1A', '#CE1126', '#FCCD12', '#009739', '#0047AB'],
  // Gold accent gradient
  gold: ['#FCCD12', '#D4A800'],
  // Green accent gradient
  green: ['#2CB750', '#009739'],
  // Pink gradient (likes)
  pink: ['#F05AA5', '#E84393', '#C7357D'],
  // Red-to-green hero gradient (from the brand mark)
  redGreen: ['#CE1126', '#8B1020', '#0B6B2A', '#009739'],
};
