import { visiblePhotos, isPhotoVisible } from '../visiblePhotos';

describe('visiblePhotos', () => {
  it('drops rejected photos', () => {
    const photos = [
      { id: 'a', moderationStatus: 'approved' },
      { id: 'b', moderationStatus: 'rejected' },
      { id: 'c', moderationStatus: 'flagged' },
    ];
    expect(visiblePhotos(photos).map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('keeps pending and flagged', () => {
    // A moderation outage must not blank the app. pending is the state
    // of every photo between upload and the provider answering.
    expect(isPhotoVisible({ moderationStatus: 'pending' })).toBe(true);
    expect(isPhotoVisible({ moderationStatus: 'flagged' })).toBe(true);
  });

  it('keeps rows with no moderationStatus at all', () => {
    // This is the shape every Photo row has until migration 00050 is
    // applied. Defaulting the unknown case to "hide" would blank every
    // photo in the app if this client shipped ahead of the migration.
    expect(isPhotoVisible({ id: 'legacy', url: 'x' })).toBe(true);
    expect(visiblePhotos([{ id: 'legacy' }])).toHaveLength(1);
  });

  it('returns [] for non-array input', () => {
    expect(visiblePhotos(undefined)).toEqual([]);
    expect(visiblePhotos(null)).toEqual([]);
    expect(visiblePhotos('nope')).toEqual([]);
  });

  it('treats a null photo as not visible', () => {
    expect(isPhotoVisible(null)).toBe(false);
    expect(visiblePhotos([null, { id: 'a' }])).toHaveLength(1);
  });
});
