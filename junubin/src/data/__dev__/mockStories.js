// Demo stories + live streams for the StoriesRow. Same roster ids as
// mockProfiles, so tapping a story opens the matching user's profile
// when the user dismisses the story — full cross-feature consistency.

import { AVATARS } from './mockProfiles';

export const mockLiveStreams = [
  {
    id: 'demo_live_001', userId: 'demo_010', userName: 'Akuol', userImage: AVATARS.demo_010,
    title: 'Studio session live', viewers: 124, startedAt: '2026-05-14T20:00:00Z',
  },
];

export const mockStories = [
  {
    id: 'demo_story_001', userId: 'demo_001', userName: 'Adau',    userImage: AVATARS.demo_001,
    isLive: false, viewed: false, postedAt: '2026-05-14T08:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_001, type: 'image', durationMs: 5000 }],
  },
  {
    id: 'demo_story_002', userId: 'demo_010', userName: 'Akuol',   userImage: AVATARS.demo_010,
    isLive: true,  viewed: false, postedAt: '2026-05-14T20:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_010, type: 'image', durationMs: 5000 }],
  },
  {
    id: 'demo_story_003', userId: 'demo_007', userName: 'Nyandeng', userImage: AVATARS.demo_007,
    isLive: false, viewed: false, postedAt: '2026-05-14T11:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_007, type: 'image', durationMs: 5000 }],
  },
  {
    id: 'demo_story_004', userId: 'demo_009', userName: 'Achol',   userImage: AVATARS.demo_009,
    isLive: false, viewed: true,  postedAt: '2026-05-14T05:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_009, type: 'image', durationMs: 5000 }],
  },
];
