// Demo conversations, message-request invites, and current-user
// fixture. All derived from the single DEMO_ROSTER in ./demoRoster.js
// so the same person you see in the inbox is the same person you see
// in the chat thread.
//
// This file exists only when DEMO_DATA_ENABLED is true. Consumer
// screens gate on that flag before reading from here.

import { DEMO_BY_ID } from './demoRoster';

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
    mode: 'Social',
    showMe: true,
    distance: 25,
  },
};

// Connections — six demo users the current-user has an open thread
// with. Each entry references the roster by id so tapping the row
// opens a chat for THAT roster member (not a fresh fake person).
// `updatedAt` is the raw timestamp for MessagesScreen's sort.
//
// IMPORTANT: the `userId` field links each match to the demo roster.
// ChatScreen reads route.params.match and looks up the matching
// roster entry by `userId || id`.
export const mockMatches = [
  { id: 'demo_match_001', userId: 'demo_001', name: 'Adau',     images: DEMO_BY_ID.demo_001.photos, lastMessage: 'Sunday brunch then?',       timestamp: '2m ago',  unread: true,  ethnicity: 'Dinka',   mode: 'social', updatedAt: '2026-05-13T19:58:00.000Z' },
  { id: 'demo_match_002', userId: 'demo_003', name: 'Nyirou',   images: DEMO_BY_ID.demo_003.photos, lastMessage: "Send me that playlist?",   timestamp: '1h ago',  unread: false, ethnicity: 'Nuer',    mode: 'social', updatedAt: '2026-05-13T18:58:00.000Z' },
  { id: 'demo_match_003', userId: 'demo_009', name: 'Achol',    images: DEMO_BY_ID.demo_009.photos, lastMessage: 'See you Saturday!',         timestamp: '3h ago',  unread: true,  ethnicity: 'Shilluk', mode: 'social', updatedAt: '2026-05-13T16:58:00.000Z' },
  { id: 'demo_match_004', userId: 'demo_006', name: 'Akech',    images: DEMO_BY_ID.demo_006.photos, lastMessage: 'I just got here, where you?', timestamp: '5h ago',  unread: false, ethnicity: 'Dinka',   mode: 'social', updatedAt: '2026-05-13T14:58:00.000Z' },
  { id: 'demo_match_005', userId: 'demo_010', name: 'Akuol',    images: DEMO_BY_ID.demo_010.photos, lastMessage: 'Coffee this weekend?',      timestamp: '7h ago',  unread: true,  ethnicity: 'Dinka',   mode: 'social', updatedAt: '2026-05-13T12:58:00.000Z' },
  { id: 'demo_match_006', userId: 'demo_007', name: 'Nyandeng', images: DEMO_BY_ID.demo_007.photos, lastMessage: 'That playlist is so good.', timestamp: '9h ago',  unread: false, ethnicity: 'Nuer',    mode: 'social', updatedAt: '2026-05-13T10:58:00.000Z' },
];

// Invites — eight demo users with a pending message request to the
// current-user. Subset of the roster that's intentionally different
// from mockMatches so the two inbox sections aren't redundant.
export const mockLikes = [
  { id: 'demo_like_001', userId: 'demo_008', name: 'Nyibol',   age: 30, images: DEMO_BY_ID.demo_008.photos, distance: '2 mi', verified: true,  activity: 'nearby', likedAt: '2026-03-25T10:12:00.000Z', country: 'AU', languages: ['English', 'Dinka'],   mode: 'social' },
  { id: 'demo_like_002', userId: 'demo_004', name: 'Athieng',  age: 25, images: DEMO_BY_ID.demo_004.photos, distance: '5 mi', verified: true,  activity: 'active', likedAt: '2026-03-24T18:42:00.000Z',                     country: 'CA', languages: ['English', 'Bari'],    mode: 'dating' },
  { id: 'demo_like_003', userId: 'demo_005', name: 'Yar',      age: 21, images: DEMO_BY_ID.demo_005.photos, distance: '4 mi', verified: false, activity: 'nearby', likedAt: '2026-03-23T14:10:00.000Z',                     country: 'US', languages: ['English', 'Dinka'],   mode: 'social' },
  { id: 'demo_like_004', userId: 'demo_002', name: 'Abuk',     age: 27, images: DEMO_BY_ID.demo_002.photos, distance: '2 mi', verified: true,  activity: 'active', likedAt: '2026-03-22T11:05:00.000Z',                     country: 'AU', languages: ['English', 'Bari'],    mode: 'social' },
  { id: 'demo_like_005', userId: 'demo_001', name: 'Adau',     age: 24, images: DEMO_BY_ID.demo_001.photos, distance: '3 mi', verified: true,  activity: 'nearby', likedAt: '2026-03-21T16:20:00.000Z', country: 'US', languages: ['English', 'Dinka'],   mode: 'dating' },
  { id: 'demo_like_006', userId: 'demo_007', name: 'Nyandeng', age: 23, images: DEMO_BY_ID.demo_007.photos, distance: '3 mi', verified: true,  activity: 'active', likedAt: '2026-03-25T01:15:00.000Z',                     country: 'US', languages: ['English', 'Nuer'],    mode: 'dating' },
  { id: 'demo_like_007', userId: 'demo_010', name: 'Akuol',    age: 28, images: DEMO_BY_ID.demo_010.photos, distance: '4 mi', verified: true,  activity: 'nearby', likedAt: '2026-03-22T03:25:00.000Z',                     country: 'US', languages: ['English', 'Dinka'],   mode: 'dating' },
  { id: 'demo_like_008', userId: 'demo_006', name: 'Akech',    age: 24, images: DEMO_BY_ID.demo_006.photos, distance: '7 mi', verified: false, activity: 'nearby', likedAt: '2026-03-20T09:00:00.000Z',                     country: 'US', languages: ['English', 'Dinka'],   mode: 'social' },
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
    { id: 'm1', sender: 'them', text: 'Hey! Thanks for accepting my message 🌻',                 time: '10:14 AM', read: true },
    { id: 'm2', sender: 'me',   text: "Hi Adau! I'm in for that asida invite.",      time: '10:18 AM', read: true },
    { id: 'm3', sender: 'them', text: 'Haha taking notes. Sunday brunch then?',      time: '10:22 AM', read: false },
  ],
  demo_003: [
    { id: 'm1', sender: 'them', text: 'Saw you follow the Nuer playlist too 👀',      time: '9:02 AM',  read: true },
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
