// ═══════════════════════════════════════════════════════════
// JuNubin — Industry palette (claude.ai/design "JuNubin Redesign").
// Steel-blue accent on paper white / near-black, hairline dividers,
// square blueprint chrome. The TOKEN NAMES are the app-wide contract
// (every screen reads colors.accent / colors.cream / colors.gray400…),
// so the redesign lands by remapping the values here — legacy names
// like `cream`, `rose` and `gold` keep existing but now resolve into
// the Industry ramps.
//
// Light:  bg #ffffff · surface #edf4fb · text #1d1f20 · accent #2e7fd0
// Dark:   bg #1a1c1e · surface #232528 · text #eceef1 · accent #5b9de6
// ═══════════════════════════════════════════════════════════

export const LightPalette = {
  // ── Text ──
  primary: '#1D1F20',

  // ── Surfaces (legacy "cream" names — now paper white) ──
  cream: '#FFFFFF',
  creamDark: '#EDF4FB',
  creamLight: '#FFFFFF',

  // ── Accent — Industry steel blue ──
  accent: '#2E7FD0',
  accentDark: '#175A9E',
  accentLight: '#D6EBFF',

  // ── Rose (legacy) — resolves to the accent ramp; nothing in the
  //    redesign is pink ──
  rose: '#2E7FD0',
  roseDark: '#2465A8',
  roseLight: '#B5D9FD',

  // ── Green — kept for success only, tuned to the neutral system ──
  green: '#2F8A52',
  greenDark: '#256E42',
  greenLight: '#E2F2E8',

  // ── Functional ──
  success: '#2F8A52',
  warning: '#C08A1A',
  error: '#B4544C',
  info: '#2E7FD0',

  // ── Core neutrals ──
  white: '#FFFFFF',
  black: '#1D1F20',

  // ── Neutral grays (Industry cool ramp) ──
  gray: '#98989B',
  gray100: '#F5F5F8',
  gray200: '#E7E7EA',
  gray300: '#D4D4D7',
  gray400: '#98989B',
  gray500: '#7A7A7D',
  gray600: '#5D5D60',
  gray700: '#424244',
  gray800: '#2B2B2D',
  gray900: '#1D1F20',

  // ── Overlay ──
  overlay: 'rgba(29, 31, 32, 0.65)',

  // ── Cards — white with a hairline ink divider ──
  cardBg: '#FFFFFF',
  cardBorder: 'rgba(29, 31, 32, 0.16)',

  // ── Tab bar ──
  tabActive: '#175A9E',
  tabInactive: '#7A7A7D',

  // ── Gold (legacy) — verified badges keep a warm mark ──
  gold: '#C08A1A',
  goldDark: '#9A6E12',

  // ── Royal (legacy) — folds into the accent ramp ──
  royal: '#175A9E',
  royalLight: '#B5D9FD',

  // ── Separator — hairline ink ──
  separator: 'rgba(29, 31, 32, 0.16)',

  // ── Semantic surface tokens ──
  surface: '#FFFFFF',
  surfaceMuted: '#EDF4FB',
  inputBg: '#EDF4FB',
  inputBorder: 'rgba(29, 31, 32, 0.16)',
  accentSurface: 'rgba(46, 127, 208, 0.10)',

  // ── Tints (overlays, badges, soft fills) ──
  accentTint08: 'rgba(46, 127, 208, 0.08)',
  accentTint15: 'rgba(46, 127, 208, 0.15)',
  roseTint12: 'rgba(46, 127, 208, 0.12)',
  roseTint20: 'rgba(46, 127, 208, 0.20)',
};

export const DarkPalette = {
  // ── Text (bright on dark) ──
  primary: '#ECEEF1',

  // ── Surfaces — graphite ──
  cream: '#1A1C1E',
  creamDark: '#141618',
  creamLight: '#232528',

  // ── Accent — steel blue, brightened for dark ──
  accent: '#5B9DE6',
  accentDark: '#7FB5F0',
  accentLight: '#B3D6FA',

  // ── Rose (legacy) — accent ramp ──
  rose: '#5B9DE6',
  roseDark: '#7FB5F0',
  roseLight: '#B3D6FA',

  // ── Green ──
  green: '#4CAF6E',
  greenDark: '#2F8A52',
  greenLight: '#1E2E24',

  // ── Functional ──
  success: '#4CAF6E',
  warning: '#D9A63C',
  error: '#D97B73',
  info: '#5B9DE6',

  // ── Core neutrals (flipped) ──
  white: '#1A1C1E',
  black: '#ECEEF1',

  // ── Neutral grays ──
  gray: '#98989B',
  gray100: '#1A1C1E',
  gray200: '#232528',
  gray300: '#2E3134',
  gray400: '#98989B',
  gray500: '#A8A8AB',
  gray600: '#B7B7BA',
  gray700: '#D4D4D7',
  gray800: '#E7E7EA',
  gray900: '#ECEEF1',

  // ── Overlay ──
  overlay: 'rgba(10, 11, 12, 0.88)',

  // ── Cards ──
  cardBg: '#232528',
  cardBorder: 'rgba(236, 238, 241, 0.18)',

  // ── Tab bar ──
  tabActive: '#B3D6FA',
  tabInactive: '#98989B',

  // ── Gold (legacy) ──
  gold: '#D9A63C',
  goldDark: '#C08A1A',

  // ── Royal (legacy) ──
  royal: '#7FB5F0',
  royalLight: '#B3D6FA',

  // ── Separator — hairline light ink ──
  separator: 'rgba(236, 238, 241, 0.18)',

  // ── Semantic surface tokens ──
  surface: '#232528',
  surfaceMuted: '#141618',
  inputBg: '#232528',
  inputBorder: 'rgba(236, 238, 241, 0.18)',
  accentSurface: 'rgba(91, 157, 230, 0.12)',

  // ── Tints ──
  accentTint08: 'rgba(91, 157, 230, 0.08)',
  accentTint15: 'rgba(91, 157, 230, 0.15)',
  roseTint12: 'rgba(91, 157, 230, 0.12)',
  roseTint20: 'rgba(91, 157, 230, 0.20)',
};
