// Demo profiles, matches, likes, comments, and current-user fixture.
// All derived from the single DEMO_ROSTER in ./demoRoster.js so the
// same person you see in the swipe deck is the same person you see
// in your matches inbox, your likes screen, and the chat thread.
//
// This file exists only when DEMO_DATA_ENABLED is true. Consumer
// screens gate on that flag before reading from here.

import { DEMO_ROSTER, DEMO_BY_ID } from './demoRoster';

// Re-export so existing screens that only need the avatar handle
// don't have to know about the roster file.
export const AVATARS = Object.fromEntries(
  DEMO_ROSTER.map((u) => [u.id, u.photos[0]]),
);

// The full swipe deck. Same shape the discover Edge Function returns
// for a real user (id, name, age, photos, mode, …).
export const mockProfiles = DEMO_ROSTER;

// Current-user fixture used by useCurrentUser when the auth session
// is empty (unauthenticated render paths). NOT a demo user — a
// neutral placeholder that's distinguishable from the roster.
export const currentUser = {
  id: 'current_user_local',
  name: 'You',
  email: '',
  avatar: null,
  images: [],
  preferences: {
    mode: 'Dating',
    showMe: true,
    lookingFor: 'Everyone',
    ageRange: [21, 35],
    distance: 25,
  },
  boosts: 0,
  superLikes: 0,
  notes: 0,
};

// Matches — six demo users the current-user is "matched with". Each
// entry references the roster by id so tapping the row opens a chat
// for THAT roster member (not a fresh fake person). `updatedAt` is
// the raw timestamp for MessagesScreen's mode-aware sort.
//
// IMPORTANT: the `userId` field links each match to the demo roster.
// ChatScreen reads route.params.match and looks up the matching
// roster entry by `userId || id`.
export const mockMatches = [
  { id: 'demo_match_001', userId: 'demo_001', name: 'Adau',     images: [AVATARS.demo_001], lastMessage: 'Sunday brunch then?',       timestamp: '2m ago',  unread: true,  ethnicity: 'Dinka',   mode: 'dating', updatedAt: '2026-05-13T19:58:00.000Z' },
  { id: 'demo_match_002', userId: 'demo_003', name: 'Nyirou',   images: [AVATARS.demo_003], lastMessage: "Send me that playlist?",   timestamp: '1h ago',  unread: false, ethnicity: 'Nuer',    mode: 'social', updatedAt: '2026-05-13T18:58:00.000Z' },
  { id: 'demo_match_003', userId: 'demo_009', name: 'Achol',    images: [AVATARS.demo_009], lastMessage: 'See you Saturday!',         timestamp: '3h ago',  unread: true,  ethnicity: 'Shilluk', mode: 'dating', updatedAt: '2026-05-13T16:58:00.000Z' },
  { id: 'demo_match_004', userId: 'demo_006', name: 'Akech',    images: [AVATARS.demo_006], lastMessage: 'I just got here, where you?', timestamp: '5h ago',  unread: false, ethnicity: 'Dinka',   mode: 'dating', updatedAt: '2026-05-13T14:58:00.000Z' },
  { id: 'demo_match_005', userId: 'demo_010', name: 'Akuol',    images: [AVATARS.demo_010], lastMessage: 'Coffee this weekend?',      timestamp: '7h ago',  unread: true,  ethnicity: 'Dinka',   mode: 'dating', updatedAt: '2026-05-13T12:58:00.000Z' },
  { id: 'demo_match_006', userId: 'demo_007', name: 'Nyandeng', images: [AVATARS.demo_007], lastMessage: 'That playlist is so good.', timestamp: '9h ago',  unread: false, ethnicity: 'Nuer',    mode: 'social', updatedAt: '2026-05-13T10:58:00.000Z' },
];

// Likes — eight demo users who liked the current-user but haven't
// matched back (i.e. current-user hasn't liked them yet). Subset of
// the roster that's intentionally different from mockMatches so the
// two inbox sections aren't redundant.
export const mockLikes = [
  { id: 'demo_like_001', userId: 'demo_008', name: 'Nyibol',   age: 30, images: [AVATARS.demo_008], distance: '2 mi', verified: true,  activity: 'nearby', likeType: 'super_like', likedAt: '2026-03-25T10:12:00.000Z', hasWhisper: true,  country: 'AU', languages: ['English', 'Dinka'],   mode: 'social' },
  { id: 'demo_like_002', userId: 'demo_004', name: 'Athieng',  age: 25, images: [AVATARS.demo_004], distance: '5 mi', verified: true,  activity: 'active', likeType: 'like',       likedAt: '2026-03-24T18:42:00.000Z',                     country: 'CA', languages: ['English', 'Bari'],    mode: 'dating' },
  { id: 'demo_like_003', userId: 'demo_005', name: 'Yar',      age: 21, images: [AVATARS.demo_005], distance: '4 mi', verified: false, activity: 'nearby', likeType: 'like',       likedAt: '2026-03-23T14:10:00.000Z',                     country: 'US', languages: ['English', 'Dinka'],   mode: 'social' },
  { id: 'demo_like_004', userId: 'demo_002', name: 'Abuk',     age: 27, images: [AVATARS.demo_002], distance: '2 mi', verified: true,  activity: 'active', likeType: 'like',       likedAt: '2026-03-22T11:05:00.000Z',                     country: 'AU', languages: ['English', 'Bari'],    mode: 'social' },
  { id: 'demo_like_005', userId: 'demo_001', name: 'Adau',     age: 24, images: [AVATARS.demo_001], distance: '3 mi', verified: true,  activity: 'nearby', likeType: 'like',       likedAt: '2026-03-21T16:20:00.000Z', hasWhisper: true,  country: 'US', languages: ['English', 'Dinka'],   mode: 'dating' },
  { id: 'demo_like_006', userId: 'demo_007', name: 'Nyandeng', age: 23, images: [AVATARS.demo_007], distance: '3 mi', verified: true,  activity: 'active', likeType: 'super_like', likedAt: '2026-03-25T01:15:00.000Z',                     country: 'US', languages: ['English', 'Nuer'],    mode: 'dating' },
  { id: 'demo_like_007', userId: 'demo_010', name: 'Akuol',    age: 28, images: [AVATARS.demo_010], distance: '4 mi', verified: true,  activity: 'nearby', likeType: 'like',       likedAt: '2026-03-22T03:25:00.000Z',                     country: 'US', languages: ['English', 'Dinka'],   mode: 'dating' },
  { id: 'demo_like_008', userId: 'demo_006', name: 'Akech',    age: 24, images: [AVATARS.demo_006], distance: '7 mi', verified: false, activity: 'nearby', likeType: 'like',       likedAt: '2026-03-20T09:00:00.000Z',                     country: 'US', languages: ['English', 'Dinka'],   mode: 'social' },
];

// Pre-seeded chat history for each demo match. Keyed by the roster
// userId, NOT the match.id, so ChatScreen can look up the thread for
// whichever demo user it just opened.
//
// Each conversation is short (3–5 messages) and ends on a message
// from the demo user — that way when the tester types a reply, the
// thread naturally continues. No fake timestamps after "now" — all
// historical.
export const mockMessages = {
  demo_001: [
    { id: 'm1', sender: 'them', text: 'Hey! Just saw we matched 🌻',                 time: '10:14 AM', read: true },
    { id: 'm2', sender: 'me',   text: "Hi Adau! I'm in for that asida invite.",      time: '10:18 AM', read: true },
    { id: 'm3', sender: 'them', text: 'Haha taking notes. Sunday brunch then?',      time: '10:22 AM', read: false },
  ],
  demo_003: [
    { id: 'm1', sender: 'them', text: 'Saw you matched on the Nuer playlist 👀',      time: '9:02 AM',  read: true },
    { id: 'm2', sender: 'me',   text: 'Caught me. Drop me the file?',                 time: '9:11 AM',  read: true },
    { id: 'm3', sender: 'them', text: "I'll send it tonight after shift.",            time: '9:13 AM',  read: true },
    { id: 'm4', sender: 'them', text: 'Send me that playlist? 🎧',                     time: '6:40 PM',  read: true },
  ],
  demo_009: [
    { id: 'm1', sender: 'me',   text: 'Achol — love your shoots, btw',                time: '8:30 AM',  read: true },
    { id: 'm2', sender: 'them', text: 'Thank you 🙏 you in London?',                   time: '8:35 AM',  read: true },
    { id: 'm3', sender: 'me',   text: "Visiting next month. Coffee plan?",            time: '8:40 AM',  read: true },
    { id: 'm4', sender: 'them', text: "Yes please. I'll send you the spot.",          time: '8:42 AM',  read: true },
    { id: 'm5', sender: 'them', text: 'See you Saturday!',                            time: '9:01 AM',  read: false },
  ],
  demo_006: [
    { id: 'm1', sender: 'them', text: "I'm at the gallery — meeting you here right?", time: '7:55 PM',  read: true },
    { id: 'm2', sender: 'me',   text: 'Almost! 2 min out',                            time: '7:57 PM',  read: true },
    { id: 'm3', sender: 'them', text: 'I just got here, where you?',                  time: '7:59 PM',  read: true },
  ],
  demo_010: [
    { id: 'm1', sender: 'them', text: 'You produce too?',                             time: '11:30 AM', read: true },
    { id: 'm2', sender: 'me',   text: 'Just a hobbyist. You make actual records!',    time: '11:45 AM', read: true },
    { id: 'm3', sender: 'them', text: 'Coffee this weekend?',                         time: '11:48 AM', read: false },
  ],
  demo_007: [
    { id: 'm1', sender: 'me',   text: 'Hi Nyandeng — that playlist on your profile slaps', time: '10:00 AM', read: true },
    { id: 'm2', sender: 'them', text: "Thank you! I'll share the spotify link.",          time: '10:05 AM', read: true },
    { id: 'm3', sender: 'them', text: 'That playlist is so good.',                        time: '10:15 AM', read: true },
  ],
};

// Post card theme presets — re-exported here for legacy importers
// that still pull POST_THEMES from this file. New code should import
// directly from src/data/postThemes.js.
export { POST_THEMES, POST_THEME_CYCLE } from '../postThemes';

// Cultural stickers re-exported for the same legacy reason. New code
// should import from src/data/culturalStickers.js.
export { CULTURAL_STICKERS } from '../culturalStickers';

// Mock community posts — three short posts that render in the
// Community feed when the API returns []. Authored by demo roster
// users so tapping the author opens that roster member's profile
// detail (not a phantom user).
export const mockPosts = [
  {
    id: 'demo_post_001', authorId: 'demo_001', user: { id: 'demo_001', name: 'Adau', avatar: AVATARS.demo_001, location: 'Minneapolis, MN' },
    timestamp: '2h ago', content: 'Asida + okra stew kind of Sunday. What\'s on your plate, diaspora?',
    likes: 24, comments: 5, reposts: 3, cardTheme: 'mint',
  },
  {
    id: 'demo_post_002', authorId: 'demo_004', user: { id: 'demo_004', name: 'Athieng', avatar: AVATARS.demo_004, location: 'Toronto, ON' },
    timestamp: '5h ago', content: 'Anyone in Toronto need a good South Sudanese restaurant recommendation? I just found one in Etobicoke that\'s undefeated.',
    likes: 18, comments: 12, reposts: 1, cardTheme: 'peach',
  },
  {
    id: 'demo_post_003', authorId: 'demo_010', user: { id: 'demo_010', name: 'Akuol', avatar: AVATARS.demo_010, location: 'Boston, MA' },
    timestamp: '1d ago', content: 'New track dropped last night. Afrobeats meets Dinka harmonies. Link in bio. Tell me what you think 🎧',
    likes: 56, comments: 22, reposts: 14, cardTheme: 'sky',
  },
];

// Mock post comments — keyed by post id from mockPosts above.
export const mockComments = {
  demo_post_001: [
    { id: 'c1', user: { name: 'Akuol',  avatar: AVATARS.demo_010 }, text: 'My mum sends me okra every month, this is the way 🙌', time: '1h ago', likes: 4 },
    { id: 'c2', user: { name: 'Achol',  avatar: AVATARS.demo_009 }, text: 'Recipe?',                                              time: '50m ago', likes: 2 },
  ],
  demo_post_002: [
    { id: 'c1', user: { name: 'Nyandeng', avatar: AVATARS.demo_007 }, text: 'Drop the name!', time: '4h ago', likes: 5 },
    { id: 'c2', user: { name: 'Akech',    avatar: AVATARS.demo_006 }, text: 'Etobicoke?? Please share, been hunting',  time: '3h ago', likes: 3 },
  ],
  demo_post_003: [
    { id: 'c1', user: { name: 'Adau',   avatar: AVATARS.demo_001 }, text: 'On repeat 🔥', time: '20h ago', likes: 9 },
    { id: 'c2', user: { name: 'Nyirou', avatar: AVATARS.demo_003 }, text: 'The bridge is a masterpiece', time: '18h ago', likes: 6 },
  ],
};
