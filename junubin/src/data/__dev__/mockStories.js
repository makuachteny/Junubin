// Demo stories for the StoriesRow. Same roster ids as mockProfiles, so
// tapping a story opens the matching user's profile when the user
// dismisses the story — full cross-feature consistency.
//
// Field shape MUST match what storyService.listActiveStoryGroups()
// returns (see src/api/services/storyService.js:121):
//   { id, userId, userName, avatar, viewed, postedAt, items }
//
// The earlier draft used `userImage` instead of `avatar`, which made
// every demo story render with an undefined photo because StoriesRow
// reads `story.avatar`. Real stories worked, demos didn't — exactly
// the silent kind of mismatch this audit hunt was for.

import { AVATARS } from './mockProfiles';

export const mockStories = [
  {
    id: 'demo_story_001', userId: 'demo_001', userName: 'Adau',    avatar: AVATARS.demo_001,
    viewed: false, postedAt: '2026-05-14T08:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_001, type: 'image', durationMs: 5000 }],
  },
  {
    id: 'demo_story_002', userId: 'demo_010', userName: 'Akuol',   avatar: AVATARS.demo_010,
    viewed: false, postedAt: '2026-05-14T20:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_010, type: 'image', durationMs: 5000 }],
  },
  {
    id: 'demo_story_003', userId: 'demo_007', userName: 'Nyandeng', avatar: AVATARS.demo_007,
    viewed: false, postedAt: '2026-05-14T11:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_007, type: 'image', durationMs: 5000 }],
  },
  {
    id: 'demo_story_004', userId: 'demo_009', userName: 'Achol',   avatar: AVATARS.demo_009,
    viewed: true,  postedAt: '2026-05-14T05:00:00Z',
    items: [{ id: 'i1', url: AVATARS.demo_009, type: 'image', durationMs: 5000 }],
  },
];
