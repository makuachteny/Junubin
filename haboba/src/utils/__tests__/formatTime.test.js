import { formatTimestamp } from '../formatTime';

describe('formatTimestamp', () => {
  it('returns empty string for falsy input', () => {
    expect(formatTimestamp(null)).toBe('');
    expect(formatTimestamp(undefined)).toBe('');
    expect(formatTimestamp('')).toBe('');
  });

  it('returns "now" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(formatTimestamp(now)).toBe('now');
  });

  it('returns minutes for timestamps within an hour', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(formatTimestamp(thirtyMinAgo)).toBe('30m ago');
  });

  it('returns hours for timestamps within a day', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatTimestamp(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for older timestamps', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimestamp(twoDaysAgo)).toBe('2d ago');
  });
});
