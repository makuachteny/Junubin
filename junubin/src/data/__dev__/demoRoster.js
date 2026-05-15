// Single canonical roster of demo users referenced by EVERY mock
// surface (swipe deck, matches, likes, chat history, stories).
// Tap "Adau" in the deck, match her, open the chat — it's the same
// person all the way through because every consumer keys off these
// stable ids.
//
// Photos are local require() handles, not server URLs — they ship
// inside the JS bundle so the deck has images in TestFlight without
// any network round trip. Real (non-demo) users get real Supabase
// Storage URLs through profileService.

// Photo handles. `p` images are the primary portraits — the same
// face every consumer uses as the avatar (swipe thumbnail, message
// avatar, map pin, chat header, etc.). `f` and `m` images are
// secondary photos — they fill out each user's ProfileDetail carousel
// so a tap on any surface opens a real multi-photo profile, not a
// stub with one image and five empty slots.
//
// Mapping rules (never edit these in a way that desynchronises the
// primary photo across surfaces):
//   - primary  = `p<n>` matching the user's roster index 001-010
//   - extras   = 3 unique secondary photos per user, drawn from the
//                f/m catalogues without overlap so visual variety
//                holds across all 10 profiles.
const PHOTOS = {
  // Primaries (face shots) — keep keys p1..p10 unchanged; this is the
  // identity each user is known by everywhere.
  p1:  require('../../assets/profiles/p1.jpg'),
  p2:  require('../../assets/profiles/p2.jpg'),
  p3:  require('../../assets/profiles/p3.jpg'),
  p4:  require('../../assets/profiles/p4.jpg'),
  p5:  require('../../assets/profiles/p5.jpg'),
  p6:  require('../../assets/profiles/p6.jpg'),
  p7:  require('../../assets/profiles/p7.jpg'),
  p8:  require('../../assets/profiles/p8.jpg'),
  p9:  require('../../assets/profiles/p9.jpg'),
  p10: require('../../assets/profiles/p10.jpg'),
  // Extras pool. Distributed across the 10 demo profiles below so no
  // two users share the same secondary photo.
  p11: require('../../assets/profiles/p11.jpg'),
  p12: require('../../assets/profiles/p12.jpg'),
  f1:  require('../../assets/profiles/f1.jpg'),
  f2:  require('../../assets/profiles/f2.jpg'),
  f3:  require('../../assets/profiles/f3.jpg'),
  f4:  require('../../assets/profiles/f4.jpg'),
  f5:  require('../../assets/profiles/f5.jpg'),
  f6:  require('../../assets/profiles/f6.jpg'),
  f7:  require('../../assets/profiles/f7.jpg'),
  f8:  require('../../assets/profiles/f8.jpg'),
  f9:  require('../../assets/profiles/f9.jpg'),
  f10: require('../../assets/profiles/f10.jpg'),
  f11: require('../../assets/profiles/f11.jpg'),
  f12: require('../../assets/profiles/f12.jpg'),
  f13: require('../../assets/profiles/f13.jpg'),
  f14: require('../../assets/profiles/f14.jpg'),
  f15: require('../../assets/profiles/f15.jpg'),
  f16: require('../../assets/profiles/f16.jpg'),
  f17: require('../../assets/profiles/f17.jpg'),
  f18: require('../../assets/profiles/f18.jpg'),
  f19: require('../../assets/profiles/f19.jpg'),
  f20: require('../../assets/profiles/f20.jpg'),
  m1:  require('../../assets/profiles/m1.jpg'),
  m2:  require('../../assets/profiles/m2.jpg'),
  m3:  require('../../assets/profiles/m3.jpg'),
  m4:  require('../../assets/profiles/m4.jpg'),
  m5:  require('../../assets/profiles/m5.jpg'),
  m6:  require('../../assets/profiles/m6.jpg'),
  m7:  require('../../assets/profiles/m7.jpg'),
  m8:  require('../../assets/profiles/m8.jpg'),
};

// IDs are stable — `demo_<n>` keeps the prefix isDemoId() looks for.
// Don't reorder these or downstream mockMessages keys break.
//
// Each roster entry carries an approximate `coords` lat/long matching
// the user's bio city. These are bucketed to ~1km precision (3
// decimal places) so the map view shows them in the right city
// without revealing a real apartment block. Real users opting in
// to the map get the same client-side bucketing.
export const DEMO_ROSTER = [
  {
    id: 'demo_001', name: 'Adau', age: 24, mode: 'Dating',
    photos: [PHOTOS.p1, PHOTOS.f1, PHOTOS.f2, PHOTOS.f3], ethnicity: 'Dinka', height: "5'8\"",
    city: 'Minneapolis, MN', coords: { latitude: 44.977, longitude: -93.265 },
    job: 'UX designer', school: 'Howard',
    bio: 'Born in Juba, raised in Minneapolis. Sundays are for asida and family calls.',
    intention: 'Long-term relationship', verified: true,
    promptQuestion: 'A fun fact about me is...', promptAnswer: "I can recite my grandmother's praise song from memory.",
    interests: ['Cooking', 'Faith', 'Music', 'Travel'], distance: 3,
    pronouns: 'she/her', lookingForGender: 'Men', children: 'Want children someday',
    activity: 'active',
  },
  {
    id: 'demo_002', name: 'Abuk', age: 27, mode: 'Social',
    photos: [PHOTOS.p2, PHOTOS.f4, PHOTOS.f5, PHOTOS.f6], ethnicity: 'Bari', height: "5'6\"",
    city: 'Sydney, NSW',    coords: { latitude: -33.869, longitude: 151.209 },
    job: 'Architect', school: 'University of Sydney',
    bio: 'Building bridges, literally and otherwise. New to Sydney — show me the city.',
    intention: 'Friendship', verified: true,
    promptQuestion: 'My ideal Sunday looks like...', promptAnswer: 'Botanic Gardens walk, then dim sum in Chinatown.',
    interests: ['Art', 'Photography', 'Travel', 'Food'], distance: 2,
    pronouns: 'she/her', activity: 'nearby',
  },
  {
    id: 'demo_003', name: 'Nyirou', age: 26, mode: 'Both',
    photos: [PHOTOS.p3, PHOTOS.f7, PHOTOS.f8, PHOTOS.f9], ethnicity: 'Nuer', height: "5'7\"",
    city: 'London, UK',      coords: { latitude: 51.507, longitude: -0.128 },
    job: 'Nurse', school: "King's College London",
    bio: 'ICU nurse who decompresses by the Thames. Looking for either a friend or a partner — open to whatever feels right.',
    intention: 'Figuring it out', verified: true,
    promptQuestion: 'The way to my heart is...', promptAnswer: 'A long walk and an even longer conversation about nothing.',
    interests: ['Faith', 'Reading', 'Running', 'Photography'], distance: 8,
    pronouns: 'she/her', lookingForGender: 'Men', children: 'No children',
    activity: 'active',
  },
  {
    id: 'demo_004', name: 'Athieng', age: 25, mode: 'Dating',
    photos: [PHOTOS.p4, PHOTOS.f10, PHOTOS.f11, PHOTOS.f12], ethnicity: 'Shilluk', height: "5'5\"",
    city: 'Toronto, ON',    coords: { latitude: 43.653, longitude: -79.383 },
    job: 'Software engineer', school: 'Carleton',
    bio: 'Toronto-based. I build for the diaspora during the day, paint at night.',
    intention: 'Long-term relationship', verified: true,
    promptQuestion: "I'm looking for someone who...", promptAnswer: "Knows what walwal is and isn't afraid of garlic.",
    interests: ['Tech', 'Art', 'Music', 'Travel'], distance: 5,
    pronouns: 'she/her', lookingForGender: 'Men',
    activity: 'active',
  },
  {
    id: 'demo_005', name: 'Yar', age: 21, mode: 'Social',
    photos: [PHOTOS.p5, PHOTOS.f13, PHOTOS.f14, PHOTOS.f15], ethnicity: 'Dinka', height: "5'9\"",
    city: 'Minneapolis, MN', coords: { latitude: 44.972, longitude: -93.236 },
    job: 'Student', school: 'University of Minnesota',
    bio: "Junior, double major. I'm here to meet other diaspora kids who get the homesick mood swings.",
    intention: 'Friendship', verified: false,
    promptQuestion: 'My most controversial opinion is...', promptAnswer: 'kisra is better than injera, fight me',
    interests: ['Music', 'Dancing', 'Fashion', 'Reading'], distance: 4,
    pronouns: 'she/her',
    activity: 'nearby',
  },
  {
    id: 'demo_006', name: 'Akech', age: 24, mode: 'Both',
    photos: [PHOTOS.p6, PHOTOS.f16, PHOTOS.f17, PHOTOS.f18], ethnicity: 'Dinka', height: "5'10\"",
    city: 'New York, NY',   coords: { latitude: 40.713, longitude: -74.006 },
    job: 'Photographer', school: 'School of Visual Arts',
    bio: 'NYC. Cameras and conversations. Up for collabs, coffee, or carefully planned road trips.',
    intention: 'Short-term relationship', verified: false,
    promptQuestion: 'Two truths and a lie...', promptAnswer: "I've been to 32 countries. I can cook molokhia. I'm afraid of cats.",
    interests: ['Photography', 'Travel', 'Music', 'Food'], distance: 7,
    pronouns: 'she/her', lookingForGender: 'Everyone',
    activity: 'nearby',
  },
  {
    id: 'demo_007', name: 'Nyandeng', age: 23, mode: 'Dating',
    photos: [PHOTOS.p7, PHOTOS.f19, PHOTOS.f20, PHOTOS.m1], ethnicity: 'Nuer', height: "5'7\"",
    city: 'Washington, DC', coords: { latitude: 38.907, longitude: -77.037 },
    job: 'Public health researcher', school: 'Johns Hopkins',
    bio: 'DC. Working on maternal health policy. Coffee in the morning, jollof in the evening.',
    intention: 'Life partner', verified: true,
    promptQuestion: 'I get along best with people who...', promptAnswer: 'read the news but can also be deeply silly.',
    interests: ['Faith', 'Reading', 'Cooking', 'Volunteering'], distance: 3,
    pronouns: 'she/her', lookingForGender: 'Men', children: 'Want children someday',
    activity: 'active',
  },
  {
    id: 'demo_008', name: 'Nyibol', age: 30, mode: 'Social',
    photos: [PHOTOS.p8, PHOTOS.m2, PHOTOS.m3, PHOTOS.m4], ethnicity: 'Dinka', height: "5'8\"",
    city: 'Sydney, NSW',    coords: { latitude: -33.881, longitude: 151.215 },
    job: 'Lawyer', school: 'University of Melbourne',
    bio: 'Sydney lawyer. Looking for friends who can talk about something other than work.',
    intention: 'Networking', verified: true,
    promptQuestion: "My love language is...", promptAnswer: "Showing up to your event even when I'm tired.",
    interests: ['Reading', 'Travel', 'Faith', 'Sports'], distance: 1,
    pronouns: 'she/her',
    activity: 'active',
  },
  {
    id: 'demo_009', name: 'Achol', age: 25, mode: 'Dating',
    photos: [PHOTOS.p9, PHOTOS.m5, PHOTOS.m6, PHOTOS.m7], ethnicity: 'Shilluk', height: "5'7\"",
    city: 'London, UK',      coords: { latitude: 51.515, longitude: -0.142 },
    job: 'Model', school: 'Self-taught',
    bio: 'London-based. Runways and home cooking. Will judge you if you put ketchup on jollof.',
    intention: 'Long-term relationship', verified: true,
    promptQuestion: 'A fun fact about me is...', promptAnswer: "I learned to braid hair before I learned to walk.",
    interests: ['Fashion', 'Photography', 'Dancing', 'Travel'], distance: 2,
    pronouns: 'she/her', lookingForGender: 'Men', children: 'Want children someday',
    activity: 'active',
  },
  {
    id: 'demo_010', name: 'Akuol', age: 28, mode: 'Both',
    photos: [PHOTOS.p10, PHOTOS.m8, PHOTOS.p11, PHOTOS.p12], ethnicity: 'Dinka', height: "5'9\"",
    city: 'Boston, MA',     coords: { latitude: 42.360, longitude: -71.059 },
    job: 'Music producer', school: 'Berklee',
    bio: 'Producing the Afrobeats-meets-South-Sudanese sound that I needed at 16. Looking for collaborators and good people.',
    intention: 'Figuring it out', verified: true,
    promptQuestion: 'My ideal Sunday looks like...', promptAnswer: 'Studio in the morning, family dinner at night.',
    interests: ['Music', 'Dancing', 'Tech', 'Photography'], distance: 4,
    pronouns: 'she/her', lookingForGender: 'Everyone',
    activity: 'nearby',
  },
];

// Quick-lookup map for ChatScreen + MessagesScreen so they don't need
// to .find() over the array on every render.
export const DEMO_BY_ID = Object.fromEntries(DEMO_ROSTER.map((u) => [u.id, u]));
