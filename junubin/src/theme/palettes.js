// ═══════════════════════════════════════════════════════════
// JuNubin — South Sudan Palette
// True flag colors tuned for UI: Red (#CE1126), Green (#009739),
// Blue (#0047AB), Gold (#FCCD12), Black, White.
// Vibrant flag red as primary accent. Clean near-black dark mode
// lets every flag color breathe. Rose pink for Likes page.
// ═══════════════════════════════════════════════════════════

export const LightPalette = {
  // ── Text ──
  primary: '#1A1A1A',

  // ── Surfaces ──
  cream: '#FFFAF7',
  creamDark: '#FFF5F0',
  creamLight: '#FFFFFF',

  // ── Accent — South Sudan Flag Red ──
  accent: '#CE1126',
  accentDark: '#A80E1F',
  accentLight: '#FDE8EB',

  // ── Rose — Vibrant Pink (Likes page) ──
  rose: '#E84393',
  roseDark: '#C7357D',
  roseLight: '#F9A8D4',

  // ── Flag Green ──
  green: '#009739',
  greenDark: '#007A2E',
  greenLight: '#E0F5E8',

  // ── Functional ──
  success: '#009739',
  warning: '#FCCD12',
  error: '#CE1126',
  info: '#0047AB',

  // ── Core neutrals ──
  white: '#FFFFFF',
  black: '#1A1A1A',

  // ── Neutral grays (warm-tinted) ──
  gray: '#8A8580',
  gray100: '#F7F5F3',
  gray200: '#EDEAE7',
  gray300: '#DDD8D4',
  gray400: '#8A8580',
  gray500: '#6B6560',
  gray600: '#4D4844',
  gray700: '#2D2926',
  gray800: '#1C1917',
  gray900: '#0F0D0C',

  // ── Overlay ──
  overlay: 'rgba(0, 0, 0, 0.65)',

  // ── Cards ──
  cardBg: '#FFFFFF',
  cardBorder: '#DDD8D4',

  // ── Tab bar ──
  tabActive: '#1A1A1A',
  // tabInactive must pass WCAG AA (4.5:1) on cream bg (#FFFAF7)
  tabInactive: '#5F5A55',

  // ── Gold — South Sudan Star Gold ──
  gold: '#FCCD12',
  goldDark: '#D4A800',

  // ── Royal — South Sudan Flag Blue ──
  royal: '#0047AB',
  royalLight: '#A3C4F3',

  // ── Separator ──
  separator: '#DDD8D4',

  // ── Semantic surface tokens ──
  surface: '#FFFFFF',
  surfaceMuted: '#F7F5F3',
  inputBg: '#F3F0ED',
  inputBorder: '#DDD8D4',
  accentSurface: 'rgba(206, 17, 38, 0.06)',

  // ── Tints (used by overlays, badges, soft fills) ──
  accentTint08: 'rgba(206, 17, 38, 0.08)',
  accentTint15: 'rgba(206, 17, 38, 0.15)',
  roseTint12: 'rgba(232, 67, 147, 0.12)',
  roseTint20: 'rgba(232, 67, 147, 0.20)',
};

export const DarkPalette = {
  // ── Text (bright on dark) ──
  primary: '#F5F3F0',

  // ── Surfaces — Clean near-black (lets flag colors pop) ──
  cream: '#0C0C0E',
  creamDark: '#060608',
  creamLight: '#141416',

  // ── Accent — Flag Red (brightened for dark) ──
  accent: '#F04C55',
  accentDark: '#CE1126',
  accentLight: '#FDE8EB',

  // ── Rose — Vibrant Pink (brightened for dark) ──
  rose: '#F05AA5',
  roseDark: '#FF6DB5',
  roseLight: '#F9A8D4',

  // ── Flag Green (brightened for dark) ──
  green: '#2CB750',
  greenDark: '#009739',
  greenLight: '#E0F5E8',

  // ── Functional ──
  success: '#2CB750',
  warning: '#FCCD12',
  error: '#F05252',
  info: '#5B93DB',

  // ── Core neutrals (flipped) ──
  white: '#0C0C0E',
  black: '#F5F3F0',

  // ── Neutral grays (subtle warm tint) ──
  gray: '#88868A',
  gray100: '#0C0C0E',
  gray200: '#141416',
  gray300: '#201E22',
  // gray400 bumped to pass WCAG AA (≥4.5:1) on dark bg #0C0C0E
  gray400: '#8E8C90',
  gray500: '#A8A6AA',
  gray600: '#B8B6BA',
  gray700: '#D5D3D7',
  gray800: '#EBEAEC',
  gray900: '#F5F3F0',

  // ── Overlay ──
  overlay: 'rgba(6, 6, 8, 0.88)',

  // ── Cards ──
  cardBg: '#141416',
  cardBorder: '#2A282C',

  // ── Tab bar ──
  tabActive: '#FFFFFF',
  tabInactive: '#88868A',

  // ── Gold — South Sudan Star Gold ──
  gold: '#FCCD12',
  goldDark: '#D4A800',

  // ── Royal — South Sudan Flag Blue ──
  royal: '#5B93DB',
  royalLight: '#A3C4F3',

  // ── Separator ──
  separator: '#201E22',

  // ── Semantic surface tokens ──
  surface: '#141416',
  surfaceMuted: '#0C0C0E',
  inputBg: '#201E22',
  inputBorder: '#2A282C',
  accentSurface: 'rgba(240, 76, 85, 0.10)',

  // ── Tints (used by overlays, badges, soft fills) ──
  accentTint08: 'rgba(240, 76, 85, 0.08)',
  accentTint15: 'rgba(240, 76, 85, 0.15)',
  roseTint12: 'rgba(240, 90, 165, 0.12)',
  roseTint20: 'rgba(240, 90, 165, 0.20)',
};
