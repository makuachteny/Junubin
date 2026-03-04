// ═══════════════════════════════════════════════════════════
// AnaJunubin — Instagram-Inspired Palette
// Monochrome foundation with Instagram's warm gradient accent.
// Primary accent drawn from the iconic story ring gradient.
// OLED-optimized dark mode.
// ═══════════════════════════════════════════════════════════

export const LightPalette = {
  // ── Text ──
  primary: '#262626',
  primaryDark: '#000000',
  primaryLight: '#363636',

  // ── Surfaces ──
  cream: '#FFFFFF',
  creamDark: '#FAFAFA',
  creamLight: '#FFFFFF',

  // ── Accent — Instagram Warm Orange ──
  accent: '#F56040',
  accentDark: '#E6683C',
  accentLight: '#FDE8E2',

  // ── Rose — Instagram Heart Red ──
  rose: '#ED4956',
  roseDark: '#D32F2F',
  roseLight: '#FDEDEF',

  // ── Functional ──
  success: '#58C322',
  warning: '#FCAF45',
  error: '#ED4956',
  info: '#0095F6',

  // ── Core neutrals ──
  white: '#FFFFFF',
  black: '#262626',

  // ── Neutral grays (Instagram light) ──
  gray: '#8E8E8E',
  grayLight: '#DBDBDB',
  grayLighter: '#EFEFEF',
  grayLightest: '#FAFAFA',
  gray100: '#FAFAFA',
  gray200: '#EFEFEF',
  gray300: '#DBDBDB',
  gray400: '#8E8E8E',
  gray500: '#737373',
  gray600: '#555555',
  gray700: '#363636',
  gray800: '#262626',
  gray900: '#121212',

  // ── Overlays ──
  overlay: 'rgba(0, 0, 0, 0.65)',
  overlayLight: 'rgba(0, 0, 0, 0.30)',

  // ── Cards ──
  cardBg: '#FFFFFF',
  cardBorder: '#DBDBDB',

  // ── Tab bar ──
  tabActive: '#262626',
  tabInactive: '#8E8E8E',

  // ── Gold — Instagram Amber ──
  gold: '#FCAF45',
  goldDark: '#F77737',
  goldLight: '#FFDC80',

  // ── Royal — Instagram Purple ──
  royal: '#833AB4',
  royalDark: '#5851DB',
  royalLight: '#C9A0DC',

  // ── Separator ──
  separator: '#DBDBDB',

  // ── Semantic surface tokens ──
  surface: '#FFFFFF',
  surfaceMuted: '#FAFAFA',
  surfaceHover: '#EFEFEF',
  inputBg: '#EFEFEF',
  inputBorder: '#DBDBDB',
  accentSurface: 'rgba(245, 96, 64, 0.06)',
  textSecondary: '#8E8E8E',
  textTertiary: '#737373',

  // ── Accent tints (derived from #F56040) ──
  accentTint04: 'rgba(245, 96, 64, 0.04)',
  accentTint05: 'rgba(245, 96, 64, 0.05)',
  accentTint06: 'rgba(245, 96, 64, 0.06)',
  accentTint08: 'rgba(245, 96, 64, 0.08)',
  accentTint10: 'rgba(245, 96, 64, 0.10)',
  accentTint12: 'rgba(245, 96, 64, 0.12)',
  accentTint15: 'rgba(245, 96, 64, 0.15)',
  accentTint25: 'rgba(245, 96, 64, 0.25)',

  // ── Rose tints (derived from #ED4956) ──
  roseTint12: 'rgba(237, 73, 86, 0.12)',
  roseTint20: 'rgba(237, 73, 86, 0.20)',
  roseTint35: 'rgba(237, 73, 86, 0.35)',
};

export const DarkPalette = {
  // ── Text (bright on dark) ──
  primary: '#F5F5F5',
  primaryDark: '#FFFFFF',
  primaryLight: '#C7C7C7',

  // ── Surfaces — OLED-optimized pure black ──
  cream: '#000000',
  creamDark: '#000000',
  creamLight: '#121212',

  // ── Accent — Instagram Warm Orange ──
  accent: '#F56040',
  accentDark: '#E6683C',
  accentLight: '#FDE8E2',

  // ── Rose — Instagram Heart Red ──
  rose: '#ED4956',
  roseDark: '#FF6B6B',
  roseLight: '#FDEDEF',

  // ── Functional ──
  success: '#58C322',
  warning: '#FCAF45',
  error: '#ED4956',
  info: '#0095F6',

  // ── Core neutrals (flipped) ──
  white: '#000000',
  black: '#F5F5F5',

  // ── Neutral grays (Instagram dark — inverted scale) ──
  gray: '#8E8E8E',
  grayLight: '#363636',
  grayLighter: '#262626',
  grayLightest: '#1C1C1C',
  gray100: '#121212',
  gray200: '#1C1C1C',
  gray300: '#262626',
  gray400: '#737373',
  gray500: '#8E8E8E',
  gray600: '#C7C7C7',
  gray700: '#DBDBDB',
  gray800: '#EFEFEF',
  gray900: '#F5F5F5',

  // ── Overlays ──
  overlay: 'rgba(0, 0, 0, 0.80)',
  overlayLight: 'rgba(0, 0, 0, 0.45)',

  // ── Cards ──
  cardBg: '#121212',
  cardBorder: '#262626',

  // ── Tab bar ──
  tabActive: '#FFFFFF',
  tabInactive: '#8E8E8E',

  // ── Gold — Instagram Amber ──
  gold: '#FCAF45',
  goldDark: '#F77737',
  goldLight: '#FFDC80',

  // ── Royal — Instagram Purple ──
  royal: '#833AB4',
  royalDark: '#5851DB',
  royalLight: '#C9A0DC',

  // ── Separator ──
  separator: '#262626',

  // ── Semantic surface tokens ──
  surface: '#121212',
  surfaceMuted: '#000000',
  surfaceHover: '#1C1C1C',
  inputBg: '#262626',
  inputBorder: '#363636',
  accentSurface: 'rgba(245, 96, 64, 0.10)',
  textSecondary: '#8E8E8E',
  textTertiary: '#737373',

  // ── Accent tints (derived from #F56040) ──
  accentTint04: 'rgba(245, 96, 64, 0.04)',
  accentTint05: 'rgba(245, 96, 64, 0.05)',
  accentTint06: 'rgba(245, 96, 64, 0.06)',
  accentTint08: 'rgba(245, 96, 64, 0.08)',
  accentTint10: 'rgba(245, 96, 64, 0.10)',
  accentTint12: 'rgba(245, 96, 64, 0.12)',
  accentTint15: 'rgba(245, 96, 64, 0.15)',
  accentTint25: 'rgba(245, 96, 64, 0.25)',

  // ── Rose tints (derived from #ED4956) ──
  roseTint12: 'rgba(237, 73, 86, 0.12)',
  roseTint20: 'rgba(237, 73, 86, 0.20)',
  roseTint35: 'rgba(237, 73, 86, 0.35)',
};
