// Demo events used by EventsScreen when the API returns []. Authored
// by the same DEMO_ROSTER users so tapping the organizer opens that
// roster member's profile (consistency requirement).

import { AVATARS } from './mockProfiles';

// EVENT_CITIES / EVENT_CATEGORIES live in src/data/eventCatalogue.js
// now and are imported from there by EventsScreen. We keep them
// re-exported here only so a legacy import path doesn't break — new
// code should pull from the catalogue file directly.
export { EVENT_CITIES, EVENT_CATEGORIES } from '../eventCatalogue';

export const mockEvents = [
  {
    id: 'demo_event_001', title: 'Diaspora Dinner Series',  organizerId: 'demo_007', organizerName: 'Nyandeng', organizerAvatar: AVATARS.demo_007,
    city: 'Minneapolis', category: 'Social',  date: '2026-06-12T18:00:00Z',
    description: 'Monthly dinner for South Sudanese folks in the Twin Cities. BYO appetite.',
    coverEmoji: '🍲', attendees: 24,
  },
  {
    id: 'demo_event_002', title: 'Afrobeats Night',          organizerId: 'demo_010', organizerName: 'Akuol',    organizerAvatar: AVATARS.demo_010,
    city: 'Boston', category: 'Arts', date: '2026-06-15T21:00:00Z',
    description: "A night of Afrobeats, Dinka tracks, and dance. I'll be DJing.",
    coverEmoji: '🎧', attendees: 87,
  },
  {
    id: 'demo_event_003', title: 'Junub Networking Mixer',   organizerId: 'demo_008', organizerName: 'Nyibol',   organizerAvatar: AVATARS.demo_008,
    city: 'Sydney', category: 'Diaspora', date: '2026-06-20T19:00:00Z',
    description: 'Lawyers, doctors, engineers, creatives — come introduce yourself.',
    coverEmoji: '🌍', attendees: 41,
  },
  {
    id: 'demo_event_004', title: 'Cultural Heritage Day',    organizerId: 'demo_003', organizerName: 'Nyirou',   organizerAvatar: AVATARS.demo_003,
    city: 'London', category: 'Cultural', date: '2026-07-04T13:00:00Z',
    description: 'Food, music, fashion. Bring your tribe.',
    coverEmoji: '🎭', attendees: 132,
  },
];
