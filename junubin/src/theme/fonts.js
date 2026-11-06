// JuNubin — Industry font system (claude.ai/design "JuNubin Redesign").
// Body: Barlow. Display/headings: Barlow Condensed.
//
// The FontFamily KEY NAMES are the app-wide contract — every screen
// styles with FontFamily.bold etc., so the redesign lands by remapping
// the values here. The display roles (extrabold/black) intentionally
// map to Barlow Condensed: in the Industry language, big names and
// screen titles are condensed while running text stays Barlow.
export const FontFamily = {
  regular: 'Barlow-Regular',
  medium: 'Barlow-Medium',
  semibold: 'Barlow-SemiBold',
  bold: 'Barlow-Bold',
  // Display roles — condensed. Used by screen titles and card names.
  extrabold: 'BarlowCondensed-SemiBold',
  black: 'BarlowCondensed-Bold',
  italic: 'Barlow-Italic',
  mediumItalic: 'Barlow-MediumItalic',
  boldItalic: 'Barlow-BoldItalic',
  // The script accent (was Dancing Script) is retired with the
  // redesign — the brand voice is condensed caps, not cursive.
  script: 'BarlowCondensed-SemiBold',
  // Explicit heading keys for new-code clarity (same faces as the
  // display roles above).
  heading: 'BarlowCondensed-SemiBold',
  headingMedium: 'BarlowCondensed-Medium',
  headingBold: 'BarlowCondensed-Bold',
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
  'Barlow-Regular': require('../../assets/fonts/Barlow-Regular.ttf'),
  'Barlow-Medium': require('../../assets/fonts/Barlow-Medium.ttf'),
  'Barlow-SemiBold': require('../../assets/fonts/Barlow-SemiBold.ttf'),
  'Barlow-Bold': require('../../assets/fonts/Barlow-Bold.ttf'),
  'Barlow-Italic': require('../../assets/fonts/Barlow-Italic.ttf'),
  'Barlow-MediumItalic': require('../../assets/fonts/Barlow-MediumItalic.ttf'),
  'Barlow-BoldItalic': require('../../assets/fonts/Barlow-BoldItalic.ttf'),
  'BarlowCondensed-Medium': require('../../assets/fonts/BarlowCondensed-Medium.ttf'),
  'BarlowCondensed-SemiBold': require('../../assets/fonts/BarlowCondensed-SemiBold.ttf'),
  'BarlowCondensed-Bold': require('../../assets/fonts/BarlowCondensed-Bold.ttf'),
};
