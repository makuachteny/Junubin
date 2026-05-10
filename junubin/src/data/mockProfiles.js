// ============================================================
// JuNubin — Mock Data
// South Sudanese community dating app
// 13 real profile photos only
// ============================================================

// ── 13 unique profile photos ──
const PHOTOS = {
  // Females (10 photos)
  p1: require('../assets/profiles/p1.jpg'),   // Smiling selfie, braids, gold necklaces
  p2: require('../assets/profiles/p2.jpg'),   // Orange top, afro with headband
  p3: require('../assets/profiles/p3.jpg'),   // Lakeside, blue knit outfit
  p4: require('../assets/profiles/p4.jpg'),   // Green/purple tie-dye dress, head wrap
  p5: require('../assets/profiles/p5.jpg'),   // White head wrap, village setting
  p6: require('../assets/profiles/p6.jpg'),   // Festival, Nike headband
  p7: require('../assets/profiles/p7.jpg'),   // Cornrows, tan knit sweater
  p8: require('../assets/profiles/p8.jpg'),   // White tank top, name necklace
  p9: require('../assets/profiles/p9.jpg'),   // Sonia Tucker — beach editorial
  p10: require('../assets/profiles/p10.jpg'), // Malaan Ajang — glamour, metallic lips
  // Males (3 photos)
  p11: require('../assets/profiles/p11.jpg'), // Traditional beaded headpiece, cattle
  p12: require('../assets/profiles/p12.jpg'), // Yellow leather jacket
  p13: require('../assets/profiles/p13.jpg'), // Horseback, traditional garb
};

// Avatars are the same images
export const AVATARS = PHOTOS;

// Re-export from utils for backward compatibility
export { imageSource } from '../utils/imageSource';

// ── Current User ────────────────────────────────────────────
export const currentUser = {
  id: 'user123',
  name: 'Deng',
  age: 25,
  avatar: AVATARS.p12,
  images: [PHOTOS.p12, PHOTOS.p11, PHOTOS.p13],
  boosts: 3,
  superLikes: 5,
  notes: 2,
  preferences: {
    mode: 'Dating',
    showMe: true,
    lookingFor: 'Women',
    ageRange: [21, 30],
    distance: 50,
  },
};

// ── Swipe Profiles ──────────────────────────────────────────
// 13 profiles — one per real photo
export const mockProfiles = [
  // ═══ FEMALE PROFILES (10) ═══
  {
    id: '1',
    name: 'Adau',
    age: 24,
    distance: 3,
    verified: true,
    mode: 'Dating',
    bio: 'Braids queen & gold lover • That smile is real',
    about: 'Born in Juba, raised in Houston. I do braids on the side and study nursing. My family is everything. Church on Sundays, volleyball on Saturdays, and a good shea butter routine every night.',
    lookingFor: 'Something serious',
    job: 'Nursing Student',
    school: 'University of Houston',
    images: [PHOTOS.p1, PHOTOS.p2, PHOTOS.p7],
    interests: ['Fashion', 'Art', 'Travel', 'Photography'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '✈️', label: 'World Traveler' },
      { emoji: '🎨', label: 'Creative' },
    ],
    height: "5'11\"",
    ethnicity: 'Dinka',
    intention: 'Something serious',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Dinka'],
  },
  {
    id: '2',
    name: 'Abuk',
    age: 27,
    distance: 2,
    verified: true,
    mode: 'Social',
    bio: 'Event planner • Community builder & connector',
    socialBio: 'Looking to connect with other South Sudanese creatives and event planners in the area',
    about: 'If there\'s a South Sudanese event in the area, chances are I planned it. Big afro, bigger personality. Love bringing people together at restaurants, lounges, and community spaces.',
    lookingFor: 'Networking & community',
    socialIntention: 'Networking',
    job: 'Event Planner',
    school: 'Howard University',
    images: [PHOTOS.p2, PHOTOS.p1, PHOTOS.p4],
    interests: ['Events', 'Fashion', 'Dancing', 'Community'],
    stickers: [
      { emoji: '🌿', label: 'Bari' },
      { emoji: '🎉', label: 'Party' },
      { emoji: '💃', label: 'Dance' },
    ],
    height: "5'7\"",
    ethnicity: 'Bari',
    intention: 'Networking',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Arabic'],
  },
  {
    id: '3',
    name: 'Nyirou',
    age: 26,
    distance: 8,
    verified: true,
    mode: 'Both',
    bio: 'Photographer • Lakeside soul, blue knit',
    socialBio: 'Looking for photography collab partners and creative friends in Minneapolis',
    about: 'I find peace near water — lakes, rivers, oceans. Born in Nasir, now living in Minneapolis near the lakes. I photograph nature and portraits and I\'m building a studio. Seeking genuine connection with someone who appreciates art and nature.',
    lookingFor: 'Something serious',
    socialIntention: 'Creative collab',
    job: 'Photographer',
    school: 'Minneapolis College of Art',
    images: [PHOTOS.p3, PHOTOS.p5, PHOTOS.p2],
    interests: ['Photography', 'Nature', 'Art', 'Travel'],
    stickers: [
      { emoji: '🐆', label: 'Nuer' },
      { emoji: '📷', label: 'Photo' },
      { emoji: '🌊', label: 'Water' },
    ],
    height: "5'9\"",
    ethnicity: 'Nuer',
    intention: 'Something serious',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Nuer'],
  },
  {
    id: '4',
    name: 'Athieng',
    age: 25,
    distance: 5,
    verified: true,
    mode: 'Social',
    bio: 'Fashion Designer • Building a cultural brand',
    socialBio: 'Want to meet other South Sudanese designers and artisans to collaborate on textile projects',
    about: 'I design clothes inspired by South Sudanese and East African textiles. Head wraps are my signature — I have over fifty! Living in Charlotte and building my fashion brand.',
    lookingFor: 'Creative friends',
    socialIntention: 'Creative collab',
    job: 'Fashion Designer',
    school: 'NC State University',
    images: [PHOTOS.p4, PHOTOS.p3, PHOTOS.p7],
    interests: ['Fashion', 'Design', 'Culture', 'Sewing'],
    stickers: [
      { emoji: '🌿', label: 'Bari' },
      { emoji: '🎨', label: 'Creative' },
      { emoji: '👗', label: 'Designer' },
    ],
    height: "5'8\"",
    ethnicity: 'Bari',
    intention: 'Creative collab',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'CA',
    languages: ['English', 'Bari'],
  },
  {
    id: '5',
    name: 'Yar',
    age: 21,
    distance: 4,
    verified: false,
    mode: 'Dating',
    bio: 'Community Worker • White head wrap, village heart',
    about: 'I grew up in a small village near Bor and moved to the US three years ago. I work with South Sudanese refugees helping them settle in. My smile is my best feature and my heart is even bigger. Looking for someone genuine.',
    lookingFor: 'Marriage-minded',
    job: 'Community Worker',
    school: 'Community College of Baltimore',
    images: [PHOTOS.p5, PHOTOS.p4, PHOTOS.p1],
    interests: ['Community', 'Faith', 'Cooking', 'Family'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '✝️', label: 'Faith' },
      { emoji: '🌍', label: 'Junub' },
    ],
    height: "5'5\"",
    ethnicity: 'Dinka',
    intention: 'Marriage-minded',
    pronouns: 'she/her',
    education: "Associate's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Dinka', 'Arabic'],
  },
  {
    id: '6',
    name: 'Akech',
    age: 24,
    distance: 7,
    verified: false,
    mode: 'Social',
    bio: 'Personal Trainer • Fitness buddy & festival crew',
    socialBio: 'Looking for workout partners and people to hit festivals with in the Phoenix area',
    about: 'You\'ll find me at every music festival, outdoor market, or 5K run in the area. I love staying active, exploring new places, and pushing myself in the gym. Grew up in Malakal, now living my best life in Phoenix.',
    lookingFor: 'Activity partners',
    socialIntention: 'Activity partners',
    job: 'Personal Trainer',
    school: 'Arizona State University',
    images: [PHOTOS.p6, PHOTOS.p2, PHOTOS.p3],
    interests: ['Fitness', 'Festivals', 'Running', 'Travel'],
    stickers: [
      { emoji: '🏛️', label: 'Shilluk' },
      { emoji: '🏃', label: 'Runner' },
      { emoji: '🎶', label: 'Festivals' },
    ],
    height: "5'8\"",
    ethnicity: 'Shilluk',
    intention: 'Activity partners',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Shilluk'],
  },
  {
    id: '7',
    name: 'Nyandeng',
    age: 23,
    distance: 3,
    verified: true,
    mode: 'Both',
    bio: 'Psychology Student • Cornrows, tan sweater',
    socialBio: 'Want to connect with other South Sudanese in mental health — let\'s build community resources together',
    about: 'Cornrows are my signature. I\'m studying clinical psychology and dream of opening a practice that serves our community. I love reading, journaling, and deep conversations over coffee. Seeking someone thoughtful and grounded.',
    lookingFor: 'Something serious',
    socialIntention: 'Networking',
    job: 'Psychology Student',
    school: 'George Washington University',
    images: [PHOTOS.p7, PHOTOS.p6, PHOTOS.p5],
    interests: ['Psychology', 'Reading', 'Self-care', 'Coffee'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '📖', label: 'Reader' },
      { emoji: '🧠', label: 'Mind' },
    ],
    height: "5'6\"",
    ethnicity: 'Dinka',
    intention: 'Something serious',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Dinka'],
  },
  {
    id: '8',
    name: 'Nyibol',
    age: 22,
    distance: 2,
    verified: true,
    mode: 'Dating',
    bio: 'Model & Student • White tank top, name necklace',
    about: 'Proud of my deep melanin and my Dinka heritage. I grew up in Nashville and started modeling while studying. I love cooking asida for my friends, thrift shopping, and late-night conversations about life and dreams.',
    lookingFor: 'Something serious',
    job: 'Model & Student',
    school: 'Tennessee State University',
    images: [PHOTOS.p8, PHOTOS.p1, PHOTOS.p6],
    interests: ['Fashion', 'Cooking', 'Thrifting', 'Music'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '🍲', label: 'Foodie' },
      { emoji: '✨', label: 'Melanin' },
    ],
    height: "5'9\"",
    ethnicity: 'Dinka',
    intention: 'Something serious',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'AU',
    languages: ['English', 'Dinka'],
  },
  {
    id: '9',
    name: 'Achol',
    age: 25,
    distance: 2,
    verified: true,
    mode: 'Social',
    bio: 'Model • Looking for my diaspora crew',
    socialBio: 'New to the city — looking for South Sudanese friends to hang with, cook with, and explore with',
    about: 'High fashion model living the dream. I\'ve walked runways in Milan, Paris, and New York. Looking for my people in a new city — friends who get the culture.',
    lookingFor: 'New friends',
    socialIntention: 'Friendship',
    job: 'High Fashion Model',
    school: '',
    images: [PHOTOS.p9, PHOTOS.p3, PHOTOS.p8],
    interests: ['Fashion', 'Travel', 'Dancing', 'Cooking'],
    stickers: [
      { emoji: '🐆', label: 'Nuer' },
      { emoji: '✨', label: 'Rising Star' },
      { emoji: '💃', label: 'Dance' },
    ],
    height: "5'10\"",
    ethnicity: 'Nuer',
    intention: 'Friendship',
    pronouns: 'she/her',
    education: "High school",
    children: 'No children',
    country: 'GB',
    languages: ['English', 'Nuer'],
  },
  {
    id: '10',
    name: 'Akuol',
    age: 25,
    distance: 5,
    verified: true,
    mode: 'Both',
    bio: 'Model & MUA • Malaan Ajang glamour',
    socialBio: 'Looking for models, photographers, and creatives to build a South Sudanese collective in Atlanta',
    about: 'Editorial glam is my specialty. Born in Wau, living in Atlanta. I walked for Fenty Beauty and now I do creative direction for campaigns that celebrate dark-skinned beauty.',
    lookingFor: 'Something serious',
    socialIntention: 'Creative collab',
    job: 'Model & MUA',
    school: 'Spelman College',
    images: [PHOTOS.p10, PHOTOS.p9, PHOTOS.p7],
    interests: ['Beauty', 'Fashion', 'Art', 'Photography'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '👑', label: 'Queen' },
      { emoji: '💄', label: 'Glam' },
    ],
    height: "5'10\"",
    ethnicity: 'Dinka',
    intention: 'Something serious',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'US',
    languages: ['English', 'Dinka'],
  },
  {
    id: '11',
    name: 'Makuei',
    age: 28,
    distance: 6,
    verified: true,
    mode: 'Social',
    bio: 'Cultural Ambassador • Preserving our heritage together',
    socialBio: 'Looking for people passionate about South Sudanese culture preservation — let\'s organize events and workshops',
    about: 'I grew up herding cattle in Bor with traditional Dinka scarification and beadwork. A photographer spotted me and now I model internationally while advocating for South Sudanese cultural preservation.',
    lookingFor: 'Community building',
    socialIntention: 'Community',
    job: 'Model & Cultural Ambassador',
    school: '',
    images: [PHOTOS.p11, PHOTOS.p12, PHOTOS.p13],
    interests: ['Culture', 'Cattle', 'Travel', 'Photography'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '🐄', label: 'Herder' },
      { emoji: '🎭', label: 'Cultural' },
    ],
    height: "6'4\"",
    ethnicity: 'Dinka',
    intention: 'Community',
    pronouns: 'he/him',
    education: "High school",
    children: 'No children',
    country: 'SS',
    languages: ['English', 'Dinka', 'Arabic'],
  },
  {
    id: '12',
    name: 'Atem',
    age: 26,
    distance: 3,
    verified: true,
    mode: 'Both',
    bio: 'Model & Music Producer • Yellow leather jacket',
    socialBio: 'Searching for vocalists, producers, and creatives to collab on Afrobeats x South Sudanese sounds',
    about: 'Fashion meets music — that\'s my lane. Born in Malakal, grew up in London. I produce Afrobeats-influenced tracks and model for streetwear brands. Looking for a creative soul who gets it and can vibe with my passion.',
    lookingFor: 'Something serious',
    socialIntention: 'Creative collab',
    job: 'Model & Music Producer',
    school: 'University of Westminster',
    images: [PHOTOS.p12, PHOTOS.p11, PHOTOS.p13],
    interests: ['Music', 'Fashion', 'Production', 'Nightlife'],
    stickers: [
      { emoji: '🏛️', label: 'Shilluk' },
      { emoji: '🎵', label: 'Music' },
      { emoji: '🔥', label: 'Streetwear' },
    ],
    height: "6'1\"",
    ethnicity: 'Shilluk',
    intention: 'Something serious',
    pronouns: 'he/him',
    education: "Bachelor's degree",
    children: 'No children',
    country: 'KE',
    languages: ['English', 'Shilluk'],
  },
  {
    id: '13',
    name: 'Garang',
    age: 29,
    distance: 7,
    verified: true,
    mode: 'Social',
    bio: 'Software Engineer • Building for the community',
    socialBio: 'Looking for South Sudanese in tech to mentor, collaborate, and build projects that serve our people',
    about: 'I build apps by day and organize community events by night. Proud South Sudanese, proud Dinka. I value faith, family, and ambition. Looking for people who share those values and want to build together.',
    lookingFor: 'Tech community',
    socialIntention: 'Networking',
    job: 'Software Engineer',
    school: 'University of Maryland',
    images: [PHOTOS.p13, PHOTOS.p12, PHOTOS.p11],
    interests: ['Tech', 'Community', 'Basketball', 'Faith'],
    stickers: [
      { emoji: '🦁', label: 'Dinka' },
      { emoji: '💻', label: 'Tech' },
      { emoji: '🏀', label: 'Basketball' },
    ],
    height: "6'4\"",
    ethnicity: 'Dinka',
    intention: 'Networking',
    pronouns: 'he/him',
    education: "Bachelor's degree",
    children: 'Want children someday',
    country: 'US',
    languages: ['English', 'Dinka'],
  },
];

// ── People who liked the current user (linked to real profiles) ──
export const mockLikes = [
  { id: 'like1', name: 'Nyibol', age: 30, images: [PHOTOS.p8], distance: '2 mi', verified: true, activity: 'nearby', likeType: 'super_like', likedAt: '2026-03-25T10:12:00.000Z', hasWhisper: true, country: 'AU', languages: ['English', 'Dinka'] },
  { id: 'like2', name: 'Akuol', age: 31, images: [PHOTOS.p10], distance: '5 mi', verified: true, activity: 'active', likeType: 'like', likedAt: '2026-03-24T18:42:00.000Z', country: 'US', languages: ['English', 'Dinka'] },
  { id: 'like3', name: 'Akech', age: 24, images: [PHOTOS.p6], distance: '7 mi', verified: false, activity: 'nearby', likeType: 'like', likedAt: '2026-03-20T09:00:00.000Z', country: 'US', languages: ['English', 'Shilluk'] },
  { id: 'like4', name: 'Achol', age: 25, images: [PHOTOS.p9], distance: '2 mi', verified: true, activity: 'active', likeType: 'super_like', likedAt: '2026-03-25T07:30:00.000Z', country: 'GB', languages: ['English', 'Nuer'] },
  { id: 'like5', name: 'Adau', age: 24, images: [PHOTOS.p1], distance: '3 mi', verified: true, activity: 'nearby', likeType: 'like', likedAt: '2026-03-23T14:10:00.000Z', hasWhisper: true, country: 'US', languages: ['English', 'Dinka'] },
  { id: 'like6', name: 'Abuk', age: 27, images: [PHOTOS.p2], distance: '2 mi', verified: true, activity: 'active', likeType: 'like', likedAt: '2026-03-22T11:05:00.000Z', country: 'US', languages: ['English', 'Arabic'] },
  { id: 'like7', name: 'Nyirou', age: 26, images: [PHOTOS.p3], distance: '8 mi', verified: true, activity: 'nearby', likeType: 'like', likedAt: '2026-03-21T16:20:00.000Z', country: 'AU', languages: ['English', 'Nuer'] },
  { id: 'like8', name: 'Athieng', age: 25, images: [PHOTOS.p4], distance: '5 mi', verified: true, activity: 'active', likeType: 'super_like', likedAt: '2026-03-24T08:40:00.000Z', country: 'CA', languages: ['English', 'Bari'] },
  { id: 'like9', name: 'Yar', age: 21, images: [PHOTOS.p5], distance: '4 mi', verified: false, activity: 'nearby', likeType: 'like', likedAt: '2026-03-18T12:00:00.000Z', country: 'US', languages: ['English', 'Dinka', 'Arabic'] },
  { id: 'like10', name: 'Nyandeng', age: 23, images: [PHOTOS.p7], distance: '3 mi', verified: true, activity: 'active', likeType: 'like', likedAt: '2026-03-25T01:15:00.000Z', country: 'US', languages: ['English', 'Dinka'] },
  { id: 'like11', name: 'Makuei', age: 28, images: [PHOTOS.p11], distance: '6 mi', verified: true, activity: 'nearby', likeType: 'like', likedAt: '2026-03-19T17:45:00.000Z', country: 'SS', languages: ['English', 'Dinka', 'Arabic'] },
  { id: 'like12', name: 'Atem', age: 26, images: [PHOTOS.p12], distance: '3 mi', verified: true, activity: 'active', likeType: 'like', likedAt: '2026-03-24T22:10:00.000Z', country: 'KE', languages: ['English', 'Shilluk'] },
  { id: 'like13', name: 'Garang', age: 29, images: [PHOTOS.p13], distance: '7 mi', verified: true, activity: 'nearby', likeType: 'like', likedAt: '2026-03-23T05:30:00.000Z', country: 'US', languages: ['English', 'Dinka'] },
  { id: 'like14', name: 'Nyibol', age: 20, images: [PHOTOS.p8], distance: '1 mi', verified: true, activity: 'active', likeType: 'super_like', likedAt: '2026-03-25T12:00:00.000Z', country: 'AU', languages: ['English', 'Dinka'] },
  { id: 'like15', name: 'Akuol', age: 28, images: [PHOTOS.p10], distance: '4 mi', verified: true, activity: 'nearby', likeType: 'like', likedAt: '2026-03-22T03:25:00.000Z', country: 'US', languages: ['English', 'Dinka'] },
];

// ── Matched connections for Messages screen (linked to real profiles) ──
export const mockMatches = [
  { id: 'match1', name: 'Adau', images: [PHOTOS.p1], lastMessage: 'Hey! How are you doing?', timestamp: '2m ago', unread: true, ethnicity: 'Dinka' },
  { id: 'match2', name: 'Achol', images: [PHOTOS.p9], lastMessage: 'That sounds great, let me know!', timestamp: '1h ago', unread: false, ethnicity: 'Shilluk' },
  { id: 'match3', name: 'Nyirou', images: [PHOTOS.p3], lastMessage: 'See you Saturday!', timestamp: '3h ago', unread: true, ethnicity: 'Nuer' },
  { id: 'match4', name: 'Akech', images: [PHOTOS.p6], lastMessage: 'I just got here, where are you?', timestamp: '5h ago', unread: false, ethnicity: 'Dinka' },
  { id: 'match5', name: 'Akuol', images: [PHOTOS.p10], lastMessage: 'Coffee this weekend?', timestamp: '7h ago', unread: true, ethnicity: 'Bari' },
  { id: 'match6', name: 'Nyandeng', images: [PHOTOS.p7], lastMessage: 'That playlist is so good.', timestamp: '9h ago', unread: false, ethnicity: 'Nuer' },
];

// ── Post card theme presets — soft pastel gradients for the
// community feed. Each theme exposes a `light` and `dark` gradient
// pair (top → bottom) plus solid `bg` / `text` / `accent` for legacy
// consumers (CreatePostScreen previewer). Text colors are tuned for
// AA contrast against the lighter end of each gradient.
export const POST_THEMES = {
  default:    { name: 'Classic',     light: ['#FBF7F2', '#F1ECE3'], dark: ['#1F1D22', '#15131A'], bg: '#FBF7F2', text: '#1A1A1A', textDark: '#F5F3F0', accent: '#009739' },
  mint:       { name: 'Mint',        light: ['#E8F6E8', '#C8E8CF'], dark: ['#16261B', '#0D1A12'], bg: '#E8F6E8', text: '#11321D', textDark: '#E8F6E8', accent: '#009739' },
  peach:      { name: 'Peach',       light: ['#FCE7D5', '#F8CDA9'], dark: ['#3A2118', '#241310'], bg: '#FCE7D5', text: '#3A1F12', textDark: '#FCE9D8', accent: '#FB923C' },
  butter:     { name: 'Butter',      light: ['#FBEFC9', '#F6E29A'], dark: ['#3A2F12', '#241D08'], bg: '#FBEFC9', text: '#3A2C0E', textDark: '#FBEFC4', accent: '#D4A800' },
  sky:        { name: 'Sky',         light: ['#E0EBF8', '#BCD4F0'], dark: ['#162B45', '#0D1B2D'], bg: '#E0EBF8', text: '#0F2440', textDark: '#DCE9F8', accent: '#0047AB' },
  lavender:   { name: 'Lavender',    light: ['#ECE3F8', '#D2BFEE'], dark: ['#241A38', '#160F23'], bg: '#ECE3F8', text: '#2D1F4A', textDark: '#E8DEF8', accent: '#7C3AED' },
  rose:       { name: 'Rose',        light: ['#FBDDDD', '#F3BEBE'], dark: ['#3A1818', '#240E0E'], bg: '#FBDDDD', text: '#3A1212', textDark: '#F8DADA', accent: '#E84393' },
  sage:       { name: 'Sage',        light: ['#E5EFDE', '#C6DAB4'], dark: ['#1F2A18', '#121A0F'], bg: '#E5EFDE', text: '#1F2D14', textDark: '#E1ECDA', accent: '#5D7A47' },
  blush:      { name: 'Blush',       light: ['#FCE3EE', '#F6BFD2'], dark: ['#3A1A28', '#240F1A'], bg: '#FCE3EE', text: '#3A1224', textDark: '#FCE0EC', accent: '#E84393' },
  // Legacy keys mapped to soft palettes so existing posts/data keep rendering.
  midnight:   { name: 'Midnight',    light: ['#E2E6EE', '#C2CADD'], dark: ['#1A1F2D', '#0E1219'], bg: '#E2E6EE', text: '#0E1322', textDark: '#E1E5EE', accent: '#0047AB' },
  savanna:    { name: 'Savanna',     light: ['#F8E8C8', '#EFD4A0'], dark: ['#3A2D14', '#241B0A'], bg: '#F8E8C8', text: '#3A2A0C', textDark: '#F8E8C8', accent: '#C0392B' },
  nile:       { name: 'Nile',        light: ['#D9F0F0', '#B2E0E0'], dark: ['#16323A', '#0C1E22'], bg: '#D9F0F0', text: '#0E2A30', textDark: '#D6F0F0', accent: '#48C9B0' },
  jubaSunset: { name: 'Juba Sunset', light: ['#FCD9C0', '#F8B988'], dark: ['#3A1F0E', '#241208'], bg: '#FCD9C0', text: '#3A1808', textDark: '#FCD9C0', accent: '#FB923C' },
  borDawn:    { name: 'Bor Dawn',    light: ['#FDE8D0', '#F8D0AB'], dark: ['#3A2818', '#24180E'], bg: '#FDE8D0', text: '#3A1808', textDark: '#FDE8D0', accent: '#E74C3C' },
  malakal:    { name: 'Malakal',     light: ['#DEE8F0', '#B6CEE0'], dark: ['#16263A', '#0E1824'], bg: '#DEE8F0', text: '#0E2040', textDark: '#DEE8F0', accent: '#C99E1E' },
  heritage:   { name: 'Heritage',    light: ['#DCE9DC', '#B8D2B8'], dark: ['#16261A', '#0E180E'], bg: '#DCE9DC', text: '#0E200E', textDark: '#DCE9DC', accent: '#D4A800' },
};

// Order in which post-theme keys cycle when a post has no explicit
// `cardTheme`. Picked to maximise visual contrast between adjacent
// cards in the feed (no two same-hue neighbours).
export const POST_THEME_CYCLE = ['mint', 'peach', 'sky', 'butter', 'lavender', 'rose', 'sage', 'blush'];

// ── Community feed posts (no external images) ───────────────
export const mockPosts = [
  {
    id: 'post1',
    user: { name: 'Garang', avatar: AVATARS.p13, location: 'Washington DC' },
    content: 'Just wrapped up an amazing South Sudanese cultural night! The music, the food, the dancing — nothing compares to our community coming together.',
    image: null,
    likes: 47,
    comments: 12,
    timestamp: '2h ago',
    cardTheme: 'midnight',
  },
  {
    id: 'post2',
    user: { name: 'Nyandeng', avatar: AVATARS.p6, location: 'Dallas, TX' },
    content: 'Looking for recommendations on South Sudanese restaurants in DFW area! Just moved here and missing home cooking.',
    image: null,
    likes: 23,
    comments: 31,
    timestamp: '5h ago',
    cardTheme: 'savanna',
  },
  {
    id: 'post3',
    user: { name: 'Abuk', avatar: AVATARS.p12, location: 'Minneapolis, MN' },
    content: 'Proud to be South Sudanese! Celebrating our independence day with family and friends.',
    image: null,
    likes: 89,
    comments: 24,
    timestamp: '8h ago',
    cardTheme: 'default',
  },
  {
    id: 'post4',
    user: { name: 'Achol', avatar: AVATARS.p9, location: 'London, UK' },
    content: 'Diaspora Connect is back! Join us for an evening of networking, South Sudanese food, and live music. Tickets are limited so sign up now!',
    image: PHOTOS.p4,
    likes: 156,
    comments: 42,
    timestamp: '3h ago',
    cardTheme: 'nile',
    signupLink: 'https://eventbrite.com/diaspora-connect-london',
    signupTitle: 'Diaspora Connect - London 2026',
  },
  {
    id: 'post5',
    user: { name: 'Makuei', avatar: AVATARS.p11, location: 'Juba, South Sudan' },
    content: 'Youth basketball tournament this Saturday! All ages welcome. Come represent your neighborhood.',
    image: PHOTOS.p13,
    likes: 73,
    comments: 18,
    timestamp: '6h ago',
    cardTheme: 'heritage',
    signupLink: 'https://forms.google.com/junub-basketball',
    signupTitle: 'Junub Basketball Tournament',
  },
  {
    id: 'post6',
    user: { name: 'Akuol', avatar: AVATARS.p10, location: 'Nairobi, Kenya' },
    content: 'Cultural Fashion Night is coming! Showcasing traditional South Sudanese designs mixed with modern fashion. Models, designers, and creators welcome. Register now!',
    image: PHOTOS.p10,
    likes: 234,
    comments: 56,
    timestamp: '1h ago',
    cardTheme: 'jubaSunset',
    signupLink: 'https://eventbrite.com/junub-fashion-night',
    signupTitle: 'Cultural Fashion Night - Nairobi',
  },
  {
    id: 'post7',
    user: { name: 'Nyibol', avatar: AVATARS.p8, location: 'Sydney, Australia' },
    content: 'South Sudanese Women in Tech meetup! Calling all sisters in STEM. Let\'s connect, share experiences, and build together.',
    image: PHOTOS.p7,
    likes: 112,
    comments: 29,
    timestamp: '4h ago',
    cardTheme: 'malakal',
    signupLink: 'https://lu.ma/junub-women-tech',
    signupTitle: 'Women in Tech - Sydney Meetup',
  },
  {
    id: 'post8',
    user: { name: 'Athieng', avatar: AVATARS.p4, location: 'Toronto, Canada' },
    content: 'Our annual Junub Food Festival is here! Kisra, walwal, and everything in between. Vendors and foodies sign up below.',
    image: PHOTOS.p5,
    likes: 189,
    comments: 67,
    timestamp: '30m ago',
    cardTheme: 'savanna',
    signupLink: 'https://forms.google.com/junub-food-fest-toronto',
    signupTitle: 'Junub Food Festival - Toronto 2026',
  },
];

// ── Community groups ────────────────────────────────────────
export const mockGroups = {
  myGroups: [
    {
      id: 'g1',
      name: 'Junub in DC',
      members: 342,
      privacy: 'public',
      rules: [
        'Be respectful and kind to all members.',
        'Keep discussions relevant to the DC-area Junub community.',
        'No spam, self-promotion, or irrelevant content.',
      ],
    },
    {
      id: 'g2',
      name: 'Dinka Singles',
      members: 1205,
      privacy: 'members',
      rules: [
        'Members only — please introduce yourself when you join.',
        'No screenshots or sharing of private conversations.',
        'Keep it respectful — this is a space for genuine connection.',
      ],
    },
    { id: 'g3', name: 'SS Foodies', members: 567, privacy: 'public' },
  ],
  discover: [
    {
      id: 'g4',
      name: 'South Sudanese Professionals',
      members: 2340,
      privacy: 'members',
      description: 'Networking and career opportunities for South Sudanese professionals worldwide.',
      rules: [
        'Verified professionals only — fill out your profile before posting.',
        'Job postings welcome on Mondays and Thursdays.',
        'No multi-level marketing or pyramid schemes.',
        'Keep critique constructive.',
      ],
    },
    {
      id: 'g5',
      name: 'Junub Culture & Heritage',
      members: 1890,
      privacy: 'public',
      description: 'Celebrating and preserving South Sudanese traditions, languages, and cultural practices.',
      rules: [
        'Cite sources when sharing historical content.',
        'Honour all 64+ tribes — no inter-tribal hostility.',
        'Original posts preferred; credit creators when reposting.',
      ],
    },
    { id: 'g6', name: 'SS Sports Hub', members: 890, privacy: 'public', description: 'Basketball, soccer, and all sports for the South Sudanese community.' },
    { id: 'g7', name: 'Faith & Fellowship', members: 1560, privacy: 'public', description: 'A space for spiritual growth and connection within our community.' },
  ],
};

// ── Cultural stickers ───────────────────────────────────────
export const CULTURAL_STICKERS = [
  { emoji: '🦁', label: 'Dinka' },
  { emoji: '🐆', label: 'Nuer' },
  { emoji: '🏛️', label: 'Shilluk' },
  { emoji: '🌿', label: 'Bari' },
  { emoji: '🌍', label: 'Junub' },
  { emoji: '🎭', label: 'Cultural' },
  { emoji: '💃', label: 'Dance' },
  { emoji: '🥘', label: 'Foodie' },
  { emoji: '⚽', label: 'Sports' },
  { emoji: '✝️', label: 'Faith' },
];

// ── Spotlight (boost) packs ─────────────────────────────────
export const SPOTLIGHT_PACKS = [
  { id: 'sp1', count: 1, price: '$5.99', label: '1 Spotlight' },
  { id: 'sp2', count: 5, price: '$19.99', label: '5 Spotlights', badge: 'POPULAR' },
  { id: 'sp3', count: 10, price: '$29.99', label: '10 Spotlights', badge: 'BEST VALUE' },
];

// ── Super Like packs ────────────────────────────────────────
export const SUPER_LIKE_PACKS = [
  { id: 'sl1', count: 5, price: '$7.99', label: '5 Super Likes' },
  { id: 'sl2', count: 15, price: '$17.99', label: '15 Super Likes', badge: 'POPULAR' },
  { id: 'sl3', count: 30, price: '$29.99', label: '30 Super Likes', badge: 'BEST VALUE' },
];

// ── Subscription tiers ──────────────────────────────────────
export const SUBSCRIPTION_TIERS = {
  plus: { name: 'JuNubin+', monthlyPrice: '$9.99', features: ['Unlimited Likes', 'Unlimited Rewinds', 'Advanced Filters', 'Whispers', 'No Ads'] },
  junub: { name: 'Junub', monthlyPrice: '$19.99', features: ['All JuNubin+ features', 'See Who Likes You', '1 Free Spotlight/month', 'Diaspora Connect', 'Incognito Mode'] },
};

// ── Chat messages per match ─────────────────────────────────
export const mockMessages = {
  match1: [
    { id: 'm1', sender: 'them', text: 'Hey! How are you doing?', time: '2:30 PM', read: true },
    { id: 'm2', sender: 'me', text: 'I\'m great! Just got back from a run. How about you?', time: '2:32 PM', read: true },
    { id: 'm3', sender: 'them', text: 'Nice! I love running too. Where do you usually go?', time: '2:33 PM', read: true },
    { id: 'm4', sender: 'me', text: 'Rock Creek Park mostly. The trails there are beautiful', time: '2:35 PM', read: true },
    { id: 'm5', sender: 'them', text: 'Oh I love that place! We should go running together sometime', time: '2:36 PM', read: false },
  ],
  match2: [
    { id: 'm1', sender: 'them', text: 'That sounds great, let me know!', time: '1:15 PM', read: true },
    { id: 'm2', sender: 'me', text: 'For sure! How about Saturday afternoon?', time: '1:20 PM', read: true },
    { id: 'm3', sender: 'them', text: 'Saturday works for me!', time: '1:22 PM', read: true },
  ],
  match3: [
    { id: 'm1', sender: 'me', text: 'Hey Adut! Love your modeling work', time: '10:00 AM', read: true },
    { id: 'm2', sender: 'them', text: 'Thank you so much! Are you in the industry too?', time: '10:05 AM', read: true },
    { id: 'm3', sender: 'me', text: 'A little bit! I mostly do photography', time: '10:08 AM', read: true },
    { id: 'm4', sender: 'them', text: 'That\'s awesome! We should collab sometime', time: '10:10 AM', read: true },
    { id: 'm5', sender: 'me', text: 'Definitely! Are you free this weekend?', time: '10:12 AM', read: true },
    { id: 'm6', sender: 'them', text: 'See you Saturday!', time: '10:15 AM', read: true },
  ],
};

// ── Post comments ───────────────────────────────────────────
// Each comment can carry `parentId` to thread replies under their parent.
// Comments without `parentId` are top-level.
export const mockComments = {
  post1: [
    { id: 'c1', user: { name: 'Makuei', avatar: AVATARS.p11 }, text: 'This was such an amazing night!', time: '1h ago', likes: 5 },
    { id: 'c1r1', parentId: 'c1', user: { name: 'Akech', avatar: AVATARS.p6 }, text: 'Right?! Best one yet.', time: '50m ago', likes: 1 },
    { id: 'c1r2', parentId: 'c1', user: { name: 'Achol', avatar: AVATARS.p9 }, text: 'Saving the date for next year already 🙌', time: '40m ago', likes: 3 },
    { id: 'c2', user: { name: 'Achol', avatar: AVATARS.p9 }, text: 'Wish I could have been there', time: '1h ago', likes: 2 },
    { id: 'c3', user: { name: 'Akuol', avatar: AVATARS.p10 }, text: 'The food was incredible', time: '45m ago', likes: 8 },
    { id: 'c3r1', parentId: 'c3', user: { name: 'Atem', avatar: AVATARS.p12 }, text: 'The walwal was unreal', time: '30m ago', likes: 2 },
    { id: 'c4', user: { name: 'Akech', avatar: AVATARS.p6 }, text: 'Next time we need to make it even bigger!', time: '30m ago', likes: 3 },
  ],
  post2: [
    { id: 'c1', user: { name: 'Nyandeng', avatar: AVATARS.p7 }, text: 'Try Mama Nyandeng\'s kitchen on Greenville Ave!', time: '4h ago', likes: 12 },
    { id: 'c1r1', parentId: 'c1', user: { name: 'Garang', avatar: AVATARS.p13 }, text: 'Seconded — best kisra in DFW', time: '3h ago', likes: 5 },
    { id: 'c2', user: { name: 'Atem', avatar: AVATARS.p12 }, text: 'Welcome to DFW!', time: '3h ago', likes: 4 },
    { id: 'c3', user: { name: 'Abuk', avatar: AVATARS.p2 }, text: 'There\'s a great one in Irving too', time: '2h ago', likes: 6 },
  ],
  post3: [
    { id: 'c1', user: { name: 'Adau', avatar: AVATARS.p1 }, text: 'Happy Independence Day!', time: '7h ago', likes: 15 },
    { id: 'c2', user: { name: 'Garang', avatar: AVATARS.p13 }, text: 'Proud to be Junub!', time: '6h ago', likes: 20 },
    { id: 'c2r1', parentId: 'c2', user: { name: 'Akuol', avatar: AVATARS.p10 }, text: '🇸🇸🇸🇸🇸🇸', time: '5h ago', likes: 8 },
  ],
};

// ── Notifications ───────────────────────────────────────────
export const mockNotifications = [
  { id: 'n1', type: 'like', user: 'Akech', avatar: AVATARS.p6, text: 'liked your profile', time: '5m ago', read: false },
  { id: 'n2', type: 'match', user: 'Adau', avatar: AVATARS.p1, text: 'You matched!', time: '2h ago', read: false },
  { id: 'n3', type: 'comment', user: 'Makuei', avatar: AVATARS.p11, text: 'commented on your post', time: '3h ago', read: true },
  { id: 'n4', type: 'follow', user: 'Achol', avatar: AVATARS.p9, text: 'started following you', time: '5h ago', read: true },
  { id: 'n5', type: 'like_post', user: 'Akuol', avatar: AVATARS.p10, text: 'liked your post', time: '8h ago', read: true },
  { id: 'n6', type: 'group', user: 'Junub in DC', avatar: AVATARS.p13, text: 'New post in your group', time: '1d ago', read: true },
  { id: 'n7', type: 'superlike', user: 'Nyandeng', avatar: AVATARS.p7, text: 'super liked you!', time: '1d ago', read: true },
  { id: 'n8', type: 'like', user: 'Nyibol', avatar: AVATARS.p8, text: 'liked your profile', time: '1d ago', read: true },
  { id: 'n9', type: 'match', user: 'Athieng', avatar: AVATARS.p4, text: 'You matched!', time: '2d ago', read: true },
  { id: 'n10', type: 'superlike', user: 'Abuk', avatar: AVATARS.p2, text: 'super liked you!', time: '2d ago', read: true },
];
