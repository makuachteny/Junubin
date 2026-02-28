import { imageSource } from '../imageSource';

describe('imageSource', () => {
  it('returns null for null/undefined', () => {
    expect(imageSource(null)).toBeNull();
    expect(imageSource(undefined)).toBeNull();
  });

  it('returns number as-is (require() assets)', () => {
    expect(imageSource(42)).toBe(42);
  });

  it('wraps string URLs in { uri }', () => {
    expect(imageSource('https://example.com/photo.jpg')).toEqual({
      uri: 'https://example.com/photo.jpg',
    });
  });

  it('returns objects as-is (already { uri })', () => {
    const obj = { uri: 'https://example.com/photo.jpg' };
    expect(imageSource(obj)).toBe(obj);
  });

  it('returns null for unsupported types', () => {
    expect(imageSource(true)).toBeNull();
    expect(imageSource(() => {})).toBeNull();
  });
});
