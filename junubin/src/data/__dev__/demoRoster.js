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

const PHOTOS = {
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
};

// IDs are stable — `demo_<n>` keeps the prefix isDemoId() looks for.
// Don't reorder these or downstream mockMessages keys break.
export const DEMO_ROSTER = [
  {
    id: 'demo_001', name: 'Adau', age: 24, mode: 'Dating',
    photos: [PHOTOS.p1], ethnicity: 'Dinka', height: "5'8\"",
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
    photos: [PHOTOS.p2], ethnicity: 'Bari', height: "5'6\"",
    job: 'Architect', school: 'University of Sydney',
    bio: 'Building bridges, literally and otherwise. New to Sydney — show me the city.',
    intention: 'Friendship', verified: true,
    promptQuestion: 'My ideal Sunday looks like...', promptAnswer: 'Botanic Gardens walk, then dim sum in Chinatown.',
    interests: ['Art', 'Photography', 'Travel', 'Food'], distance: 2,
    pronouns: 'she/her', activity: 'nearby',
  },
  {
    id: 'demo_003', name: 'Nyirou', age: 26, mode: 'Both',
    photos: [PHOTOS.p3], ethnicity: 'Nuer', height: "5'7\"",
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
    photos: [PHOTOS.p4], ethnicity: 'Shilluk', height: "5'5\"",
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
    photos: [PHOTOS.p5], ethnicity: 'Dinka', height: "5'9\"",
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
    photos: [PHOTOS.p6], ethnicity: 'Dinka', height: "5'10\"",
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
    photos: [PHOTOS.p7], ethnicity: 'Nuer', height: "5'7\"",
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
    photos: [PHOTOS.p8], ethnicity: 'Dinka', height: "5'8\"",
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
    photos: [PHOTOS.p9], ethnicity: 'Shilluk', height: "5'7\"",
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
    photos: [PHOTOS.p10], ethnicity: 'Dinka', height: "5'9\"",
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
