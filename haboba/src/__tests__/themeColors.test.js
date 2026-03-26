import { LightPalette, DarkPalette } from '../theme/palettes';

describe('South Sudan Theme Palette', () => {
  describe('LightPalette', () => {
    it('has sunset orange as primary accent', () => {
      expect(LightPalette.accent).toBe('#E8613C');
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

    it('has all accent tints derived from orange', () => {
      expect(LightPalette.accentTint08).toContain('232, 97, 60');
      expect(LightPalette.accentTint15).toContain('232, 97, 60');
    });

    it('has all rose tints derived from pink', () => {
      expect(LightPalette.roseTint12).toContain('232, 67, 147');
    });
  });

  describe('DarkPalette', () => {
    it('has brightened orange accent for dark mode', () => {
      expect(DarkPalette.accent).toBe('#F06D47');
    });

    it('has brightened pink rose for dark mode', () => {
      expect(DarkPalette.rose).toBe('#F05AA5');
    });

    it('has OLED black cream', () => {
      expect(DarkPalette.cream).toBe('#000000');
    });

    it('has inverted gray scale', () => {
      // In dark mode, gray100 is darkest, gray900 is lightest
      expect(DarkPalette.gray100).toBe('#0F0D0C');
      expect(DarkPalette.gray900).toBe('#F5F0ED');
    });

    it('has flag green', () => {
      expect(DarkPalette.green).toBe('#00B844');
    });
  });
});
