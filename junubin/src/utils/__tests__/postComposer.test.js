import { buildPostContent } from '../postComposer';

describe('buildPostContent', () => {
  it('combines content with location', () => {
    const text = buildPostContent({
      content: 'Weekend plans?',
      location: 'Nairobi',
    });

    expect(text).toContain('Weekend plans?');
    expect(text).toContain('📍 Nairobi');
  });

  it('skips empty blocks', () => {
    const text = buildPostContent({
      content: 'Hello',
      location: '   ',
    });
    expect(text).toBe('Hello');
  });
});

