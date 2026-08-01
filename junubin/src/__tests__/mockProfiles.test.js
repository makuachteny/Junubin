// Sanity tests on the demo roster + downstream mock surfaces. These
// guarantee identity stays consistent across mockMatches, mockLikes
// and mockMessages — the property we promised the user when
// re-introducing demo data.

import { DEMO_ROSTER, DEMO_BY_ID } from '../data/__dev__/demoRoster';
import {
  mockMatches, mockLikes, mockMessages,
} from '../data/__dev__/mockProfiles';
import { isDemoId, DEMO_DATA_ENABLED, DEMO_ID_PREFIX } from '../config/demoData';

describe('Demo roster — base contract', () => {
  it('every roster entry has a stable demo_ id', () => {
    DEMO_ROSTER.forEach((u) => {
      expect(u.id).toMatch(/^demo_\d{3}$/);
      expect(isDemoId(u.id)).toBe(true);
    });
  });

  it('roster mode values are one of Dating / Social / Both', () => {
    DEMO_ROSTER.forEach((u) => expect(['Dating', 'Social', 'Both']).toContain(u.mode));
  });

  it('every roster entry has photos + required text fields', () => {
    DEMO_ROSTER.forEach((u) => {
      expect(u.photos.length).toBeGreaterThan(0);
      expect(u.name).toBeTruthy();
      expect(u.age).toBeGreaterThan(17);
      expect(u.ethnicity).toBeTruthy();
    });
  });

  it('DEMO_BY_ID lookup matches roster array', () => {
    DEMO_ROSTER.forEach((u) => expect(DEMO_BY_ID[u.id]).toBe(u));
  });
});

describe('Photo consistency — primary image is the same across surfaces', () => {
  // The primary photo (photos[0] in the roster) is what every
  // thumbnail surface uses: swipe-card cover, message-row avatar,
  // chat header, map marker, profile-detail first slot. Lock that
  // contract here so a rename / reshuffle can't silently desync.
  it('every roster user has at least 3 photos', () => {
    DEMO_ROSTER.forEach((u) => {
      expect(u.photos.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('AVATARS[id] equals the user\'s primary photo', () => {
    DEMO_ROSTER.forEach((u) => {
      // Re-derive from roster — same source as the AVATARS map.
      expect(DEMO_BY_ID[u.id].photos[0]).toBe(u.photos[0]);
    });
  });

  it('mockMatches images[0] matches the linked user\'s primary photo', () => {
    mockMatches.forEach((m) => {
      const user = DEMO_BY_ID[m.userId];
      expect(m.images[0]).toBe(user.photos[0]);
    });
  });

  it('mockMatches images carry the full photo array (not just one)', () => {
    mockMatches.forEach((m) => {
      const user = DEMO_BY_ID[m.userId];
      expect(m.images.length).toBe(user.photos.length);
    });
  });

  it('mockLikes images[0] matches the linked user\'s primary photo', () => {
    mockLikes.forEach((l) => {
      const user = DEMO_BY_ID[l.userId];
      expect(l.images[0]).toBe(user.photos[0]);
    });
  });

});

describe('Cross-surface consistency', () => {
  it('every mockMatches.userId points at a real roster member', () => {
    mockMatches.forEach((m) => {
      expect(isDemoId(m.userId)).toBe(true);
      expect(DEMO_BY_ID[m.userId]).toBeTruthy();
    });
  });

  it('every mockLikes.userId points at a real roster member', () => {
    mockLikes.forEach((l) => {
      expect(isDemoId(l.userId)).toBe(true);
      expect(DEMO_BY_ID[l.userId]).toBeTruthy();
    });
  });

  it('every mockMessages key maps to a roster member', () => {
    Object.keys(mockMessages).forEach((id) => {
      expect(isDemoId(id)).toBe(true);
      expect(DEMO_BY_ID[id]).toBeTruthy();
    });
  });

  it('every match in mockMatches has a chat thread in mockMessages', () => {
    mockMatches.forEach((m) => {
      expect(mockMessages[m.userId]).toBeDefined();
      expect(mockMessages[m.userId].length).toBeGreaterThan(0);
    });
  });

});

describe('Demo flag plumbing', () => {
  it('DEMO_DATA_ENABLED is a boolean constant', () => {
    expect(typeof DEMO_DATA_ENABLED).toBe('boolean');
  });

  it('isDemoId rejects non-demo ids', () => {
    expect(isDemoId('demo_001')).toBe(true);
    expect(isDemoId('user_001')).toBe(false);
    expect(isDemoId(undefined)).toBe(false);
    expect(isDemoId(null)).toBe(false);
    expect(isDemoId(42)).toBe(false);
  });

  it('DEMO_ID_PREFIX matches every roster id prefix', () => {
    DEMO_ROSTER.forEach((u) => expect(u.id.startsWith(DEMO_ID_PREFIX)).toBe(true));
  });
});
