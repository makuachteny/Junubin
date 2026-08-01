import { LightPalette, DarkPalette } from '../theme/palettes';
import { FontFamily, fontAssets } from '../theme/fonts';

// Industry palette (claude.ai/design "JuNubin Redesign"): steel-blue
// accent on paper white / graphite, hairline ink dividers, Barlow +
// Barlow Condensed type. These tests lock the redesign's foundation —
// if someone reverts a token to the dating-era flag palette, this is
// what catches it.
describe('Industry Theme Palette', () => {
  describe('LightPalette', () => {
    it('has steel blue as primary accent', () => {
      expect(LightPalette.accent).toBe('#2E7FD0');
    });

    it('legacy rose tokens resolve into the accent ramp (nothing is pink)', () => {
      expect(LightPalette.rose).toBe(LightPalette.accent);
      expect(LightPalette.roseTint12).toContain('46, 127, 208');
    });

    it('has paper-white background', () => {
      expect(LightPalette.cream).toBe('#FFFFFF');
      expect(LightPalette.surfaceMuted).toBe('#EDF4FB');
    });

    it('has hairline ink separators', () => {
      expect(LightPalette.separator).toBe('rgba(29, 31, 32, 0.16)');
      expect(LightPalette.cardBorder).toBe(LightPalette.separator);
    });

    it('has accent tints derived from steel blue', () => {
      expect(LightPalette.accentTint08).toContain('46, 127, 208');
      expect(LightPalette.accentTint15).toContain('46, 127, 208');
    });

    it('uses a muted error red (not flag red)', () => {
      expect(LightPalette.error).toBe('#B4544C');
    });
  });

  describe('DarkPalette', () => {
    it('has brightened steel blue accent for dark mode', () => {
      expect(DarkPalette.accent).toBe('#5B9DE6');
    });

    it('has graphite background and surface', () => {
      expect(DarkPalette.cream).toBe('#1A1C1E');
      expect(DarkPalette.surface).toBe('#232528');
    });

    it('has inverted gray scale', () => {
      expect(DarkPalette.gray100).toBe('#1A1C1E');
      expect(DarkPalette.gray900).toBe('#ECEEF1');
    });

    it('has hairline light-ink separators', () => {
      expect(DarkPalette.separator).toBe('rgba(236, 238, 241, 0.18)');
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
