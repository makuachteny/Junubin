import { LightPalette, DarkPalette } from '../theme/palettes';

describe('South Sudan Theme Palette', () => {
  describe('LightPalette', () => {
    it('has flag red as primary accent', () => {
      expect(LightPalette.accent).toBe('#CE1126');
    });

    it('has vibrant pink as rose', () => {
      expect(LightPalette.rose).toBe('#E84393');
    });

    it('has flag green', () => {
      expect(LightPalette.green).toBe('#009739');
    });

    it('has flag blue as royal', () => {
      expect(LightPalette.royal).toBe('#0047AB');
    });

    it('has gold star color', () => {
      expect(LightPalette.gold).toBe('#FCCD12');
    });

    it('has flag red as error', () => {
      expect(LightPalette.error).toBe('#CE1126');
    });

    it('has warm-tinted cream surface', () => {
      expect(LightPalette.cream).toBe('#FFFAF7');
    });

    it('has visible roseLight pink', () => {
      expect(LightPalette.roseLight).toBe('#F9A8D4');
    });

    it('has all accent tints derived from flag red', () => {
      expect(LightPalette.accentTint08).toContain('206, 17, 38');
      expect(LightPalette.accentTint15).toContain('206, 17, 38');
    });

    it('has all rose tints derived from pink', () => {
      expect(LightPalette.roseTint12).toContain('232, 67, 147');
    });
  });

  describe('DarkPalette', () => {
    it('has brightened flag red accent for dark mode', () => {
      expect(DarkPalette.accent).toBe('#F04C55');
    });

    it('has brightened pink rose for dark mode', () => {
      expect(DarkPalette.rose).toBe('#F05AA5');
    });

    it('has clean near-black surface', () => {
      expect(DarkPalette.cream).toBe('#0C0C0E');
    });

    it('has inverted gray scale', () => {
      expect(DarkPalette.gray100).toBe('#0C0C0E');
      expect(DarkPalette.gray900).toBe('#F5F3F0');
    });

    it('has brightened flag green', () => {
      expect(DarkPalette.green).toBe('#2CB750');
    });
  });
});
