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
  // Screen header — used by sub-screens / modal headers ("Edit Profile",
  // "Settings", etc.). Stays compact so it doesn't compete with the body
  // content of those screens.
  screenTitle: { fontFamily: FontFamily.bold, fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.25 },
  // Top-level tab page name — Connect / Community / Likes / Chats.
  // Same heavy display style across all four tabs so swiping between them
  // doesn't visually re-anchor the header. Single source of truth so
  // adding a future tab inherits the same look.
  tabTitle: { fontFamily: FontFamily.black, fontSize: 32, fontWeight: '900', lineHeight: 38, letterSpacing: -0.5 },
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
  // Canonical header height — every screen header should be this tall so
  // navigation between screens never causes the title row to jump.
  headerHeight: 56,
  // Canonical horizontal padding for headers + the filter strip beneath them.
  headerPaddingX: 16,
  // Vertical gap between the header and the filter strip.
  filterGap: 10,
  // Header chrome sizing — avatars, icon buttons, back buttons.
  headerAvatarSize: 34,
  headerIconSize: 22,
  headerBackIconSize: 24,
};

// ─── Accessibility ───
// Baseline constants every interactive surface should honor.
export const A11y = {
  // iOS HIG / Material: 44x44 logical points minimum.
  minTouchTarget: 44,
  // WCAG 2.1 AA contrast ratios.
  contrast: {
    bodyText: 4.5,
    largeText: 3.0,
    uiComponent: 3.0,
  },
  // Smallest font size considered legible for body text.
  minBodyFontSize: 14,
  // Icons paired with labels may use this; standalone UI text should use minBodyFontSize+.
  minCaptionFontSize: 12,
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

// Industry gradients — everything resolves into the steel-blue ramp or
// flag ink. The KEY NAMES are legacy (rose/gold/flagRing callers
// exist across screens); the values are the redesign.
export const Gradients = {
  primary: ['#1F2833', '#161D26'],
  accent: ['#0F8FD6', '#085F91'],
  rose: ['#54B3E6', '#0F8FD6'],
  royal: ['#0B74AF', '#085F91', '#06496F'],
  splash: ['#10161D', '#161D26', '#10161D'],
  card: ['transparent', 'rgba(14, 24, 34, 0.78)'],
  storyRing: ['#085F91', '#0F8FD6', '#54B3E6'],
  southSudan: ['#085F91', '#0F8FD6', '#54B3E6'],
  warm: ['#54B3E6', '#0F8FD6'],
  flagRing: ['#085F91', '#0F8FD6', '#54B3E6'],
  gold: ['#F0B41F', '#C08A1A'],
  green: ['#0F9D58', '#0C7A45'],
  pink: ['#54B3E6', '#0F8FD6', '#0B74AF'],
  redGreen: ['#0F8FD6', '#0B74AF', '#085F91'],
};
