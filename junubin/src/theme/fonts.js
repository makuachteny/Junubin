// JuNubin — Professional DM Sans Font System
// Uses bundled DM Sans files for deterministic typography and weights.

export const FontFamily = {
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  semibold: 'DMSans-SemiBold',
  bold: 'DMSans-Bold',
  extrabold: 'DMSans-ExtraBold',
  black: 'DMSans-Black',
  italic: 'DMSans-Italic',
  mediumItalic: 'DMSans-MediumItalic',
  boldItalic: 'DMSans-BoldItalic',
  script: 'DancingScript-Bold',
};

// Helper: given a numeric fontWeight string, return the correct fontFamily
export function fontForWeight(weight = '400') {
  switch (weight) {
    case '900': return FontFamily.black;
    case '800': return FontFamily.extrabold;
    case '700': return FontFamily.bold;
    case '600': return FontFamily.semibold;
    case '500': return FontFamily.medium;
    case '400':
    default:
      return FontFamily.regular;
  }
}

// Bundled font assets loaded at app startup.
export const fontAssets = {
  'DMSans-Regular': require('../../assets/fonts/DMSans-Regular.ttf'),
  'DMSans-Medium': require('../../assets/fonts/DMSans-Medium.ttf'),
  'DMSans-SemiBold': require('../../assets/fonts/DMSans-SemiBold.ttf'),
  'DMSans-Bold': require('../../assets/fonts/DMSans-Bold.ttf'),
  'DMSans-ExtraBold': require('../../assets/fonts/DMSans-ExtraBold.ttf'),
  'DMSans-Black': require('../../assets/fonts/DMSans-Black.ttf'),
  'DMSans-Italic': require('../../assets/fonts/DMSans-Italic.ttf'),
  'DMSans-MediumItalic': require('../../assets/fonts/DMSans-MediumItalic.ttf'),
  'DMSans-BoldItalic': require('../../assets/fonts/DMSans-BoldItalic.ttf'),
  'DancingScript-Bold': require('../../assets/fonts/DancingScript-Bold.ttf'),
};
