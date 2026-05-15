// Demo stories for the StoriesRow. Same roster ids as mockProfiles, so
// tapping a story opens the matching user's profile when the user
// dismisses the story — full cross-feature consistency.
//
// Field shape MUST match what storyService.listActiveStoryGroups()
// returns (see src/api/services/storyService.js:121):
//   { id, userId, userName, avatar, stories: [{ id, type, uri, text, bgColor, duration }] }
//
// Previous drafts used `items: [{ url }]` which made the StoriesViewScreen
// crash because it reads `storyGroup.stories[i].uri`. Real stories
// worked, demos didn't.

import { AVATARS } from './mockProfiles';

const DEFAULT_DURATION_MS = 5000;

export const mockStories = [
  {
    id: 'demo_story_001', userId: 'demo_001', userName: 'Adau',    avatar: AVATARS.demo_001,
    viewed: false, postedAt: '2026-05-14T08:00:00Z',
    stories: [{ id: 'i1', type: 'image', uri: AVATARS.demo_001, text: null, bgColor: null, duration: DEFAULT_DURATION_MS }],
  },
  {
    id: 'demo_story_002', userId: 'demo_010', userName: 'Akuol',   avatar: AVATARS.demo_010,
    viewed: false, postedAt: '2026-05-14T20:00:00Z',
    stories: [{ id: 'i1', type: 'image', uri: AVATARS.demo_010, text: null, bgColor: null, duration: DEFAULT_DURATION_MS }],
  },
  {
    id: 'demo_story_003', userId: 'demo_007', userName: 'Nyandeng', avatar: AVATARS.demo_007,
    viewed: false, postedAt: '2026-05-14T11:00:00Z',
    stories: [{ id: 'i1', type: 'image', uri: AVATARS.demo_007, text: null, bgColor: null, duration: DEFAULT_DURATION_MS }],
  },
  {
    id: 'demo_story_004', userId: 'demo_009', userName: 'Achol',   avatar: AVATARS.demo_009,
    viewed: true,  postedAt: '2026-05-14T05:00:00Z',
    stories: [{ id: 'i1', type: 'image', uri: AVATARS.demo_009, text: null, bgColor: null, duration: DEFAULT_DURATION_MS }],
  },
];
