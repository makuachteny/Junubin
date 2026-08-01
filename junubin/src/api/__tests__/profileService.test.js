import { normalizeProfile } from '../services/profileService';

describe('normalizeProfile', () => {
  it('returns null for null input', () => {
    expect(normalizeProfile(null)).toBeNull();
  });

  it('converts API user to UI shape', () => {
    const apiUser = {
      id: 'user-1',
      displayName: 'Adau',
      dateOfBirth: '2000-06-15T00:00:00.000Z',
      isVerified: true,
      gender: 'woman',
      photos: [
        { url: 'https://example.com/p1.jpg', sortOrder: 0 },
        { url: 'https://example.com/p2.jpg', sortOrder: 1 },
      ],
      profile: {
        bio: 'Hello world',
        job: 'Designer',
        school: 'University',
        heightCm: 170,
        ethnicity: 'Dinka',
        interests: ['music', 'travel'],
        stickers: [{ emoji: '🇸🇸', label: 'Junub' }],
        pronouns: 'she/her',
        education: 'Bachelors',
        lookingFor: 'Community',
      },
    };

    const result = normalizeProfile(apiUser);

    expect(result.id).toBe('user-1');
    expect(result.name).toBe('Adau');
    expect(result.verified).toBe(true);
    expect(result.bio).toBe('Hello world');
    expect(result.job).toBe('Designer');
    expect(result.ethnicity).toBe('Dinka');
    expect(result.gender).toBe('woman');

    // Images should be plain URL strings, not { uri } objects
    expect(result.images).toEqual([
      'https://example.com/p1.jpg',
      'https://example.com/p2.jpg',
    ]);

    // Height should be converted to feet/inches string
    expect(result.height).toMatch(/\d'\d+"/);

    // Age should be calculated from dateOfBirth
    expect(typeof result.age).toBe('number');
    expect(result.age).toBeGreaterThan(20);

    // Raw API data preserved
    expect(result._raw).toBe(apiUser);
  });

  it('handles user with no photos', () => {
    const apiUser = {
      id: 'user-2',
      displayName: 'Test',
      photos: [],
      profile: {},
    };
    const result = normalizeProfile(apiUser);
    expect(result.images).toEqual([]);
  });

  it('handles user with no profile', () => {
    const apiUser = {
      id: 'user-3',
      displayName: 'Test',
      photos: [],
    };
    const result = normalizeProfile(apiUser);
    expect(result.bio).toBe('');
    expect(result.interests).toEqual([]);
  });
});
