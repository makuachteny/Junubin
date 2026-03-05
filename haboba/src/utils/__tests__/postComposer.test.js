import { buildPostContent } from '../postComposer';

describe('buildPostContent', () => {
  it('combines content with location, tags, and poll', () => {
    const text = buildPostContent({
      content: 'Weekend plans?',
      location: 'Nairobi',
      tags: ['Ayen', 'Deng'],
      pollQuestion: 'Dinner tonight?',
      pollOptions: ['Yes', 'No'],
    });

    expect(text).toContain('Weekend plans?');
    expect(text).toContain('📍 Nairobi');
    expect(text).toContain('👥 with @Ayen, @Deng');
    expect(text).toContain('📊 Poll: Dinner tonight?');
    expect(text).toContain('• Yes');
    expect(text).toContain('• No');
  });

  it('skips empty blocks', () => {
    const text = buildPostContent({
      content: 'Hello',
      location: '   ',
      tags: [],
      pollQuestion: 'Q',
      pollOptions: ['only one'],
    });
    expect(text).toBe('Hello');
  });
});

