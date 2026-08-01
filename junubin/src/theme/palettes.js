// ═══════════════════════════════════════════════════════════
// JuNubin — Industry palette (claude.ai/design "JuNubin Redesign").
// Warm paper ground, steel-blue accent, and the South Sudan flag
// colors promoted to a working system (ss* tokens): gold CTAs, ink
// tab bar, red/green/gold/blue tag tints. The TOKEN NAMES are the
// app-wide contract (every screen reads colors.accent / colors.cream
// / colors.gray400…), so the redesign lands by remapping the values
// here — legacy names like `cream`, `rose` and `gold` keep existing
// but now resolve into the Industry ramps.
//
// Light:  bg #fdfcfa · surface #f4f1ea · text #252a30 · accent #0f8fd6
// Dark:   bg #161d26 · surface #1f2833 · text #eef1f4 · accent #4db4ef
//
// ss* convention: `ssX` is the flag color itself, `ssXTint` is the
// soft fill behind it, `ssXDark` is text that reads on that tint —
// like accentDark, the "Dark" step flips lighter in dark mode.
// ═══════════════════════════════════════════════════════════

export const LightPalette = {
  // ── Text ──
  primary: '#252A30',

  // ── Surfaces (legacy "cream" names — now warm paper) ──
  cream: '#FDFCFA',
  creamDark: '#F4F1EA',
  creamLight: '#FFFFFF',

  // ── Accent — Industry steel blue ──
  accent: '#0F8FD6',
  accentDark: '#085F91',
  accentLight: '#54B3E6',

  // ── Rose (legacy) — resolves to the accent ramp; nothing in the
  //    redesign is pink ──
  rose: '#0F8FD6',
  roseDark: '#0B74AF',
  roseLight: '#54B3E6',

  // ── Green — the flag green ──
  green: '#0F9D58',
  greenDark: '#0C7A45',
  greenLight: '#E3F4EA',

  // ── Functional ──
  success: '#0F9D58',
  warning: '#F0B41F',
  error: '#D94A4A',
  info: '#0F8FD6',

  // ── Core neutrals ──
  white: '#FFFFFF',
  black: '#252A30',

  // ── Neutral grays — warm paper ramp toward cool ink ──
  gray: '#98938A',
  gray100: '#F7F5F0',
  gray200: '#EDEAE2',
  gray300: '#DDD9CE',
  gray400: '#98938A',
  gray500: '#77726A',
  gray600: '#5E5B55',
  gray700: '#45464A',
  gray800: '#31353B',
  gray900: '#252A30',

  // ── Overlay ──
  overlay: 'rgba(20, 33, 46, 0.65)',

  // ── Cards — paper with a hairline warm divider ──
  cardBg: '#FDFCFA',
  cardBorder: '#E7E2D8',

  // ── Tab bar — ink bar in both modes; gold marks the active tab ──
  tabActive: '#F0B41F',
  tabInactive: 'rgba(238, 241, 244, 0.55)',
  tabBarBg: '#14212E',

  // ── Gold — the flag gold; primary CTA color ──
  gold: '#F0B41F',
  goldDark: '#8F6A0A',

  // ── Royal (legacy) — folds into the accent ramp ──
  royal: '#085F91',
  royalLight: '#54B3E6',

  // ── Separator — hairline warm ──
  separator: '#E7E2D8',

  // ── Semantic surface tokens ──
  surface: '#FDFCFA',
  surfaceMuted: '#F4F1EA',
  inputBg: '#F4F1EA',
  inputBorder: '#E7E2D8',
  accentSurface: 'rgba(15, 143, 214, 0.10)',

  // ── Tints (overlays, badges, soft fills) ──
  accentTint08: 'rgba(15, 143, 214, 0.08)',
  accentTint15: 'rgba(15, 143, 214, 0.15)',
  roseTint12: 'rgba(15, 143, 214, 0.12)',
  roseTint20: 'rgba(15, 143, 214, 0.20)',

  // ── South Sudan flag system ──
  ssInk: '#14212E',
  ssRed: '#D94A4A',
  ssGreen: '#0F9D58',
  ssGold: '#F0B41F',
  ssBlue: '#0F8FD6',
  ssRedTint: '#FBE9E7',
  ssGreenTint: '#E3F4EA',
  ssGoldTint: '#FBF1D3',
  ssBlueTint: '#E2F2FB',
  ssRedDark: '#A33636',
  ssGreenDark: '#0C7A45',
  ssGoldDark: '#8F6A0A',
  ssBlueDark: '#085F91',
  // Ink readable on the gold CTA in both modes.
  onGold: '#241B03',
  onInk: '#F5F7F9',
};

export const DarkPalette = {
  // ── Text (bright on dark) ──
  primary: '#EEF1F4',

  // ── Surfaces — deep blue-graphite ──
  cream: '#161D26',
  creamDark: '#10161D',
  creamLight: '#1F2833',

  // ── Accent — steel blue, brightened for dark ──
  accent: '#4DB4EF',
  accentDark: '#AADCF8',
  accentLight: '#74C5F3',

  // ── Rose (legacy) — accent ramp ──
  rose: '#4DB4EF',
  roseDark: '#74C5F3',
  roseLight: '#AADCF8',

  // ── Green ──
  green: '#3DBD75',
  greenDark: '#8ED9AE',
  greenLight: 'rgba(61, 189, 117, 0.16)',

  // ── Functional ──
  success: '#3DBD75',
  warning: '#EEC04F',
  error: '#E56671',
  info: '#4DB4EF',

  // ── Core neutrals (flipped) ──
  white: '#161D26',
  black: '#EEF1F4',

  // ── Neutral grays ──
  gray: '#A2A7AD',
  gray100: '#161D26',
  gray200: '#1F2833',
  gray300: '#2A3542',
  gray400: '#A2A7AD',
  gray500: '#A2A7AD',
  gray600: '#C0C4C9',
  gray700: '#D5D8DC',
  gray800: '#E4E7EA',
  gray900: '#EEF1F4',

  // ── Overlay ──
  overlay: 'rgba(8, 13, 19, 0.88)',

  // ── Cards ──
  cardBg: '#1F2833',
  cardBorder: 'rgba(238, 241, 244, 0.14)',

  // ── Tab bar — ink bar in both modes; gold marks the active tab ──
  tabActive: '#EEC04F',
  tabInactive: 'rgba(238, 241, 244, 0.55)',
  tabBarBg: '#0E1822',

  // ── Gold ──
  gold: '#EEC04F',
  goldDark: '#F4D78E',

  // ── Royal (legacy) ──
  royal: '#AADCF8',
  royalLight: '#74C5F3',

  // ── Separator — hairline light ink ──
  separator: 'rgba(238, 241, 244, 0.14)',

  // ── Semantic surface tokens ──
  surface: '#1F2833',
  surfaceMuted: '#10161D',
  inputBg: '#1F2833',
  inputBorder: 'rgba(238, 241, 244, 0.14)',
  accentSurface: 'rgba(77, 180, 239, 0.12)',

  // ── Tints ──
  accentTint08: 'rgba(77, 180, 239, 0.08)',
  accentTint15: 'rgba(77, 180, 239, 0.15)',
  roseTint12: 'rgba(77, 180, 239, 0.12)',
  roseTint20: 'rgba(77, 180, 239, 0.20)',

  // ── South Sudan flag system ──
  ssInk: '#0E1822',
  ssRed: '#E56671',
  ssGreen: '#3DBD75',
  ssGold: '#EEC04F',
  ssBlue: '#4DB4EF',
  ssRedTint: 'rgba(229, 102, 113, 0.16)',
  ssGreenTint: 'rgba(61, 189, 117, 0.16)',
  ssGoldTint: 'rgba(238, 192, 79, 0.16)',
  ssBlueTint: 'rgba(77, 180, 239, 0.16)',
  ssRedDark: '#F2A3AA',
  ssGreenDark: '#8ED9AE',
  ssGoldDark: '#F4D78E',
  ssBlueDark: '#AADCF8',
  onGold: '#241B03',
  onInk: '#F5F7F9',
};
