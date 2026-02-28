// AnaJubin — Responsive scaling utilities
// Base design: iPhone 14/15 (393 x 852)

import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

// Scale based on screen width (for horizontal dimensions, font sizes, paddings)
export const wp = (size) => (SCREEN_WIDTH / BASE_WIDTH) * size;

// Scale based on screen height (for vertical dimensions, spacing)
export const hp = (size) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;

// Moderate scale — halfway between fixed and fully scaled (best for fonts)
export const ms = (size, factor = 0.5) => size + (wp(size) - size) * factor;

// Clamp a value between min and max
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Is this a small screen? (iPhone SE / 8)
export const isSmallScreen = SCREEN_HEIGHT < 700;

// Is this a large screen? (Pro Max / Plus)
export const isLargeScreen = SCREEN_HEIGHT > 900;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
