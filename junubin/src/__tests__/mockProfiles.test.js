// Sanity tests on the demo roster + downstream mock surfaces. These
// guarantee identity stays consistent across mockProfiles, mockMatches,
// mockLikes, mockMessages, mockPosts, mockEvents, and mockStories —
// the property we promised the user when re-introducing demo data.

import { DEMO_ROSTER, DEMO_BY_ID } from '../data/__dev__/demoRoster';
import {
  mockProfiles, mockMatches, mockLikes, mockMessages, mockPosts, mockComments,
} from '../data/__dev__/mockProfiles';
import { mockEvents } from '../data/__dev__/mockEvents';
import { mockStories, mockLiveStreams } from '../data/__dev__/mockStories';
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

describe('Cross-surface consistency', () => {
  it('mockProfiles IS the roster', () => {
    expect(mockProfiles).toBe(DEMO_ROSTER);
  });

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

  it('every mockPosts.authorId points at a real roster member', () => {
    mockPosts.forEach((p) => {
      expect(isDemoId(p.authorId)).toBe(true);
      expect(DEMO_BY_ID[p.authorId]).toBeTruthy();
    });
  });

  it('every mockComments key maps to a real mock post', () => {
    const postIds = new Set(mockPosts.map((p) => p.id));
    Object.keys(mockComments).forEach((k) => expect(postIds.has(k)).toBe(true));
  });

  it('every mockEvents organizerId points at a real roster member', () => {
    mockEvents.forEach((e) => {
      expect(isDemoId(e.organizerId)).toBe(true);
      expect(DEMO_BY_ID[e.organizerId]).toBeTruthy();
    });
  });

  it('every mockStories.userId points at a real roster member', () => {
    mockStories.forEach((s) => {
      expect(isDemoId(s.userId)).toBe(true);
      expect(DEMO_BY_ID[s.userId]).toBeTruthy();
    });
  });

  it('every mockLiveStreams.userId points at a real roster member', () => {
    mockLiveStreams.forEach((l) => {
      expect(isDemoId(l.userId)).toBe(true);
      expect(DEMO_BY_ID[l.userId]).toBeTruthy();
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
