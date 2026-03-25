// AnaJunubin — Mock Stories Data
import { AVATARS } from './mockProfiles';

export const mockLiveStreams = [
  {
    id: 'live1',
    userId: '3',
    userName: 'Nyajima',
    avatar: AVATARS.p3,
    title: 'Cooking South Sudanese kisra \u{1F372}',
    viewerCount: 47,
    startedAt: Date.now() - 600000, // 10 min ago
    isLive: true,
  },
  {
    id: 'live2',
    userId: '9',
    userName: 'Chan',
    avatar: AVATARS.p9,
    title: 'Vibes from Juba tonight',
    viewerCount: 128,
    startedAt: Date.now() - 1800000, // 30 min ago
    isLive: true,
  },
];

export const mockStories = [
  {
    id: 'story1',
    userId: '1',
    userName: 'Akuol',
    avatar: AVATARS.p1,
    stories: [
      { id: 's1a', type: 'image', uri: AVATARS.p1, duration: 5000, createdAt: Date.now() - 3600000 },
    ],
  },
  {
    id: 'story2',
    userId: '3',
    userName: 'Nyajima',
    avatar: AVATARS.p3,
    isLive: true, // Currently live
    stories: [
      { id: 's2a', type: 'text', text: 'New in London! Any Junubin here? \uD83C\uDF0D', bgColor: '#0047AB', duration: 5000, createdAt: Date.now() - 7200000 },
    ],
  },
  {
    id: 'story3',
    userId: '5',
    userName: 'Achol',
    avatar: AVATARS.p5,
    stories: [
      { id: 's3a', type: 'image', uri: AVATARS.p5, duration: 5000, createdAt: Date.now() - 1800000 },
      { id: 's3b', type: 'text', text: 'Weekend vibes \u2728', bgColor: '#0047AB', duration: 5000, createdAt: Date.now() - 1200000 },
    ],
  },
  {
    id: 'story4',
    userId: '7',
    userName: 'Adut',
    avatar: AVATARS.p7,
    stories: [
      { id: 's4a', type: 'image', uri: AVATARS.p7, duration: 5000, createdAt: Date.now() - 900000 },
    ],
  },
  {
    id: 'story5',
    userId: '9',
    userName: 'Chan',
    avatar: AVATARS.p9,
    isLive: true, // Currently live
    stories: [
      { id: 's5a', type: 'text', text: 'Who wants to grab coffee in Juba? \u2615', bgColor: '#009739', duration: 5000, createdAt: Date.now() - 600000 },
    ],
  },
];
