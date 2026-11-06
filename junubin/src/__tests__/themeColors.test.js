import { LightPalette, DarkPalette } from '../theme/palettes';
import { FontFamily, fontAssets } from '../theme/fonts';

// Industry palette (claude.ai/design "JuNubin Redesign"): steel-blue
// accent on warm paper / deep blue-graphite, the South Sudan flag
// colors as a working system (gold CTAs, ink tab bar, tag tints),
// Barlow + Barlow Condensed type. These tests lock the redesign's
// foundation — if someone reverts a token to an older palette, this
// is what catches it.
describe('Industry Theme Palette', () => {
  describe('LightPalette', () => {
    it('has steel blue as primary accent', () => {
      expect(LightPalette.accent).toBe('#0F8FD6');
    });

    it('legacy rose tokens resolve into the accent ramp (nothing is pink)', () => {
      expect(LightPalette.rose).toBe(LightPalette.accent);
      expect(LightPalette.roseTint12).toContain('15, 143, 214');
    });

    it('has warm paper background', () => {
      expect(LightPalette.cream).toBe('#FDFCFA');
      expect(LightPalette.surfaceMuted).toBe('#F4F1EA');
    });

    it('has hairline warm separators', () => {
      expect(LightPalette.separator).toBe('#E7E2D8');
      expect(LightPalette.cardBorder).toBe(LightPalette.separator);
    });

    it('has accent tints derived from steel blue', () => {
      expect(LightPalette.accentTint08).toContain('15, 143, 214');
      expect(LightPalette.accentTint15).toContain('15, 143, 214');
    });

    it('uses the flag red for errors', () => {
      expect(LightPalette.error).toBe('#D94A4A');
      expect(LightPalette.error).toBe(LightPalette.ssRed);
    });

    it('flag system: gold CTA with readable ink, ink tab bar', () => {
      expect(LightPalette.ssGold).toBe('#F0B41F');
      expect(LightPalette.gold).toBe(LightPalette.ssGold);
      expect(LightPalette.onGold).toBe('#241B03');
      expect(LightPalette.ssInk).toBe('#14212E');
      expect(LightPalette.tabBarBg).toBe(LightPalette.ssInk);
      expect(LightPalette.tabActive).toBe(LightPalette.ssGold);
    });

    it('flag tints pair with their readable darks', () => {
      ['Red', 'Green', 'Gold', 'Blue'].forEach((c) => {
        expect(LightPalette[`ss${c}`]).toBeDefined();
        expect(LightPalette[`ss${c}Tint`]).toBeDefined();
        expect(LightPalette[`ss${c}Dark`]).toBeDefined();
      });
    });
  });

  describe('DarkPalette', () => {
    it('has brightened steel blue accent for dark mode', () => {
      expect(DarkPalette.accent).toBe('#4DB4EF');
    });

    it('has deep blue-graphite background and surface', () => {
      expect(DarkPalette.cream).toBe('#161D26');
      expect(DarkPalette.surface).toBe('#1F2833');
    });

    it('has inverted gray scale', () => {
      expect(DarkPalette.gray100).toBe('#161D26');
      expect(DarkPalette.gray900).toBe('#EEF1F4');
    });

    it('has hairline light-ink separators', () => {
      expect(DarkPalette.separator).toBe('rgba(238, 241, 244, 0.14)');
    });

    it('keeps the ink tab bar with gold active in dark mode', () => {
      expect(DarkPalette.tabBarBg).toBe('#0E1822');
      expect(DarkPalette.tabActive).toBe(DarkPalette.ssGold);
      expect(DarkPalette.onGold).toBe('#241B03');
    });

    it('flag "Dark" steps flip lighter for dark surfaces', () => {
      expect(DarkPalette.ssRedDark).toBe('#F2A3AA');
      expect(DarkPalette.ssBlueDark).toBe('#AADCF8');
    });
  });

  describe('Industry fonts', () => {
    it('body roles are Barlow', () => {
      expect(FontFamily.regular).toBe('Barlow-Regular');
      expect(FontFamily.bold).toBe('Barlow-Bold');
    });

    it('display roles are Barlow Condensed', () => {
      expect(FontFamily.black).toBe('BarlowCondensed-Bold');
      expect(FontFamily.extrabold).toBe('BarlowCondensed-SemiBold');
      expect(FontFamily.heading).toBe('BarlowCondensed-SemiBold');
    });

    it('every FontFamily value has a bundled asset', () => {
      Object.values(FontFamily).forEach((face) => {
        expect(fontAssets[face]).toBeDefined();
      });
    });
  });
});
