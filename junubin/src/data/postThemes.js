// Post card theme presets — soft pastel gradients for the community
// feed. Each theme exposes a `light` and `dark` gradient pair
// (top → bottom) plus solid `bg` / `text` / `accent` for legacy
// consumers (CreatePostScreen previewer). Text colors are tuned for
// AA contrast against the lighter end of each gradient.
//
// This is static reference data — every post in the DB picks a key
// from here, the value is read at render time. Not user data; ship
// it. Pulled out of the deleted __dev__/mockProfiles bundle so the
// app no longer depends on a mock-named file for production styles.

export const POST_THEMES = {
  default:    { name: 'Classic',     light: ['#FBF7F2', '#F1ECE3'], dark: ['#1F1D22', '#15131A'], bg: '#FBF7F2', text: '#1A1A1A', textDark: '#F5F3F0', accent: '#009739' },
  mint:       { name: 'Mint',        light: ['#E8F6E8', '#C8E8CF'], dark: ['#16261B', '#0D1A12'], bg: '#E8F6E8', text: '#11321D', textDark: '#E8F6E8', accent: '#009739' },
  peach:      { name: 'Peach',       light: ['#FCE7D5', '#F8CDA9'], dark: ['#3A2118', '#241310'], bg: '#FCE7D5', text: '#3A1F12', textDark: '#FCE9D8', accent: '#FB923C' },
  butter:     { name: 'Butter',      light: ['#FBEFC9', '#F6E29A'], dark: ['#3A2F12', '#241D08'], bg: '#FBEFC9', text: '#3A2C0E', textDark: '#FBEFC4', accent: '#D4A800' },
  sky:        { name: 'Sky',         light: ['#E0EBF8', '#BCD4F0'], dark: ['#162B45', '#0D1B2D'], bg: '#E0EBF8', text: '#0F2440', textDark: '#DCE9F8', accent: '#0047AB' },
  lavender:   { name: 'Lavender',    light: ['#ECE3F8', '#D2BFEE'], dark: ['#241A38', '#160F23'], bg: '#ECE3F8', text: '#2D1F4A', textDark: '#E8DEF8', accent: '#7C3AED' },
  rose:       { name: 'Rose',        light: ['#FBDDDD', '#F3BEBE'], dark: ['#3A1818', '#240E0E'], bg: '#FBDDDD', text: '#3A1212', textDark: '#F8DADA', accent: '#E84393' },
  sage:       { name: 'Sage',        light: ['#E5EFDE', '#C6DAB4'], dark: ['#1F2A18', '#121A0F'], bg: '#E5EFDE', text: '#1F2D14', textDark: '#E1ECDA', accent: '#5D7A47' },
  blush:      { name: 'Blush',       light: ['#FCE3EE', '#F6BFD2'], dark: ['#3A1A28', '#240F1A'], bg: '#FCE3EE', text: '#3A1224', textDark: '#FCE0EC', accent: '#E84393' },
  // Legacy keys mapped to soft palettes so existing posts/data keep rendering.
  midnight:   { name: 'Midnight',    light: ['#E2E6EE', '#C2CADD'], dark: ['#1A1F2D', '#0E1219'], bg: '#E2E6EE', text: '#0E1322', textDark: '#E1E5EE', accent: '#0047AB' },
  savanna:    { name: 'Savanna',     light: ['#F8E8C8', '#EFD4A0'], dark: ['#3A2D14', '#241B0A'], bg: '#F8E8C8', text: '#3A2A0C', textDark: '#F8E8C8', accent: '#C0392B' },
  nile:       { name: 'Nile',        light: ['#D9F0F0', '#B2E0E0'], dark: ['#16323A', '#0C1E22'], bg: '#D9F0F0', text: '#0E2A30', textDark: '#D6F0F0', accent: '#48C9B0' },
  jubaSunset: { name: 'Juba Sunset', light: ['#FCD9C0', '#F8B988'], dark: ['#3A1F0E', '#241208'], bg: '#FCD9C0', text: '#3A1808', textDark: '#FCD9C0', accent: '#FB923C' },
  borDawn:    { name: 'Bor Dawn',    light: ['#FDE8D0', '#F8D0AB'], dark: ['#3A2818', '#24180E'], bg: '#FDE8D0', text: '#3A1808', textDark: '#FDE8D0', accent: '#E74C3C' },
  malakal:    { name: 'Malakal',     light: ['#DEE8F0', '#B6CEE0'], dark: ['#16263A', '#0E1824'], bg: '#DEE8F0', text: '#0E2040', textDark: '#DEE8F0', accent: '#C99E1E' },
  heritage:   { name: 'Heritage',    light: ['#DCE9DC', '#B8D2B8'], dark: ['#16261A', '#0E180E'], bg: '#DCE9DC', text: '#0E200E', textDark: '#DCE9DC', accent: '#D4A800' },
};

// Order in which post-theme keys cycle when a post has no explicit
// `cardTheme`. Picked to maximise visual contrast between adjacent
// cards in the feed (no two same-hue neighbours).
export const POST_THEME_CYCLE = ['mint', 'peach', 'sky', 'butter', 'lavender', 'rose', 'sage', 'blush'];
