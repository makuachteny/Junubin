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
  },
  {
    id: '2',
    name: 'Abuk',
    age: 27,
    distance: 2,
    verified: true,
    bio: 'Event planner • Orange top & big energy',
    about: 'If there\'s a South Sudanese event in the area, chances are I planned it. Big afro, bigger personality. Love bringing people together at restaurants, lounges, and community spaces. Looking for someone who can match this energy.',
    lookingFor: 'Let\'s see where it goes',
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
    intention: 'Figuring it out',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
  },
  {
    id: '3',
    name: 'Nyirou',
    age: 26,
    distance: 8,
    verified: true,
    bio: 'Photographer • Lakeside soul, blue knit',
    about: 'I find peace near water — lakes, rivers, oceans. Born in Nasir, now living in Minneapolis near the lakes. I photograph nature and portraits and I\'m building a studio. Seeking genuine connection with someone who appreciates art and nature.',
    lookingFor: 'Something serious',
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
  },
  {
    id: '4',
    name: 'Athieng',
    age: 25,
    distance: 5,
    verified: true,
    bio: 'Fashion Designer • Green/purple tie-dye dress',
    about: 'I design clothes inspired by South Sudanese and East African textiles. Head wraps are my signature — I have over fifty! Living in Charlotte and building my fashion brand. Looking for someone who appreciates creativity and cultural pride.',
    lookingFor: 'Something serious',
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
    intention: 'Something serious',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
  },
  {
    id: '5',
    name: 'Yar',
    age: 21,
    distance: 4,
    verified: false,
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
  },
  {
    id: '6',
    name: 'Akech',
    age: 24,
    distance: 7,
    verified: false,
    bio: 'Personal Trainer • Festival season, Nike headband',
    about: 'You\'ll find me at every music festival, outdoor market, or 5K run in the area. I love staying active, exploring new places, and pushing myself in the gym. Grew up in Malakal, now living my best life in Phoenix.',
    lookingFor: 'Let\'s see where it goes',
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
    intention: 'Figuring it out',
    pronouns: 'she/her',
    education: "Bachelor's degree",
    children: 'No children',
  },
  {
    id: '7',
    name: 'Nyandeng',
    age: 23,
    distance: 3,
    verified: true,
    bio: 'Psychology Student • Cornrows, tan sweater',
    about: 'Cornrows are my signature. I\'m studying clinical psychology and dream of opening a practice that serves our community. I love reading, journaling, and deep conversations over coffee. Seeking someone thoughtful and grounded.',
    lookingFor: 'Something serious',
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
  },
  {
    id: '8',
    name: 'Nyibol',
    age: 22,
    distance: 2,
    verified: true,
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
  },
  {
    id: '9',
    name: 'Achol',
    age: 25,
    distance: 2,
    verified: true,
    bio: 'Model • Beach editorial, Sonia Tucker',
    about: 'High fashion model living the dream. I\'ve walked runways in Milan, Paris, and New York. Looking for someone who understands the grind but also knows how to have fun and enjoy life to the fullest.',
    lookingFor: 'Let\'s see where it goes',
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
    intention: 'Figuring it out',
    pronouns: 'she/her',
    education: "High school",
    children: 'No children',
  },
  {
    id: '10',
    name: 'Akuol',
    age: 25,
    distance: 5,
    verified: true,
    bio: 'Model & MUA • Malaan Ajang glamour',
    about: 'Editorial glam is my specialty. Born in Wau, living in Atlanta. I walked for Fenty Beauty and now I do creative direction for campaigns that celebrate dark-skinned beauty. Looking for someone who appreciates artistry.',
    lookingFor: 'Something serious',
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
  },
  {
    id: '11',
    name: 'Makuei',
    age: 28,
    distance: 6,
    verified: true,
    bio: 'Cultural Ambassador • Traditional beaded headpiece, cattle',
    about: 'I grew up herding cattle in Bor with traditional Dinka scarification and beadwork. A photographer spotted me and now I model internationally while advocating for South Sudanese cultural preservation. Seeking someone who values heritage.',
    lookingFor: 'Marriage-minded',
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
    intention: 'Marriage-minded',
    pronouns: 'he/him',
    education: "High school",
    children: 'No children',
  },
  {
    id: '12',
    name: 'Atem',
    age: 26,
    distance: 3,
    verified: true,
    bio: 'Model & Music Producer • Yellow leather jacket',
    about: 'Fashion meets music — that\'s my lane. Born in Malakal, grew up in London. I produce Afrobeats-influenced tracks and model for streetwear brands. Looking for a creative soul who gets it and can vibe with my passion.',
    lookingFor: 'Something serious',
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
  },
  {
    id: '13',
    name: 'Garang',
    age: 29,
    distance: 7,
    verified: true,
    bio: 'Software Engineer • Horseback, traditional garb',
    about: 'I build apps by day and organize community events by night. Proud South Sudanese, proud Dinka. I value faith, family, and ambition. Looking for someone who shares those values and understands the importance of roots.',
    lookingFor: 'Marriage-minded',
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
    intention: 'Marriage-minded',
    pronouns: 'he/him',
    education: "Bachelor's degree",
    children: 'Want children someday',
  },
];

// ── People who liked the current user (linked to real profiles) ──
export const mockLikes = [
  { id: 'like1', name: 'Nyibol', age: 30, images: [PHOTOS.p8], distance: '2 mi', verified: true, activity: 'nearby' },
  { id: 'like2', name: 'Akuol', age: 31, images: [PHOTOS.p10], distance: '5 mi', verified: true, activity: 'active' },
  { id: 'like3', name: 'Akech', age: 24, images: [PHOTOS.p6], distance: '7 mi', verified: false, activity: 'nearby' },
  { id: 'like4', name: 'Achol', age: 25, images: [PHOTOS.p9], distance: '2 mi', verified: true, activity: 'active' },
  { id: 'like5', name: 'Adau', age: 24, images: [PHOTOS.p1], distance: '3 mi', verified: true, activity: 'nearby' },
  { id: 'like6', name: 'Abuk', age: 27, images: [PHOTOS.p2], distance: '2 mi', verified: true, activity: 'active' },
  { id: 'like7', name: 'Nyirou', age: 26, images: [PHOTOS.p3], distance: '8 mi', verified: true, activity: 'nearby' },
  { id: 'like8', name: 'Athieng', age: 25, images: [PHOTOS.p4], distance: '5 mi', verified: true, activity: 'active' },
  { id: 'like9', name: 'Yar', age: 21, images: [PHOTOS.p5], distance: '4 mi', verified: false, activity: 'nearby' },
  { id: 'like10', name: 'Nyandeng', age: 23, images: [PHOTOS.p7], distance: '3 mi', verified: true, activity: 'active' },
  { id: 'like11', name: 'Makuei', age: 28, images: [PHOTOS.p11], distance: '6 mi', verified: true, activity: 'nearby' },
  { id: 'like12', name: 'Atem', age: 26, images: [PHOTOS.p12], distance: '3 mi', verified: true, activity: 'active' },
  { id: 'like13', name: 'Garang', age: 29, images: [PHOTOS.p13], distance: '7 mi', verified: true, activity: 'nearby' },
  { id: 'like14', name: 'Nyibol', age: 20, images: [PHOTOS.p8], distance: '1 mi', verified: true, activity: 'active' },
  { id: 'like15', name: 'Akuol', age: 28, images: [PHOTOS.p10], distance: '4 mi', verified: true, activity: 'nearby' },
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

// ── Post card theme presets (South Sudanese inspired) ───────
export const POST_THEMES = {
  default: { bg: '#FFFFFF', text: '#262626', accent: '#F56040', name: 'Classic' },
  midnight: { bg: '#262626', text: '#FFFFFF', accent: '#ED4956', name: 'Midnight' },
  savanna: { bg: '#F5E6CC', text: '#5D4037', accent: '#C0392B', name: 'Savanna' },
  nile: { bg: '#0E4D64', text: '#FFFFFF', accent: '#48C9B0', name: 'Nile' },
  jubaSunset: { bg: '#7C2D12', text: '#FFFFFF', accent: '#FB923C', name: 'Juba Sunset' },
  borDawn: { bg: '#FDE8D0', text: '#6C3483', accent: '#E74C3C', name: 'Bor Dawn' },
  malakal: { bg: '#1A5276', text: '#FFFFFF', accent: '#F9E79F', name: 'Malakal' },
  heritage: { bg: '#1B4332', text: '#FFFFFF', accent: '#F9A825', name: 'Heritage' },
};

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
    cardTheme: 'blush',
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
];

// ── Community groups ────────────────────────────────────────
export const mockGroups = {
  myGroups: [
    { id: 'g1', name: 'Junub in DC', members: 342 },
    { id: 'g2', name: 'Dinka Singles', members: 1205 },
    { id: 'g3', name: 'SS Foodies', members: 567 },
  ],
  discover: [
    { id: 'g4', name: 'South Sudanese Professionals', members: 2340, description: 'Networking and career opportunities for South Sudanese professionals worldwide.' },
    { id: 'g5', name: 'Junub Culture & Heritage', members: 1890, description: 'Celebrating and preserving South Sudanese traditions, languages, and cultural practices.' },
    { id: 'g6', name: 'SS Sports Hub', members: 890, description: 'Basketball, soccer, and all sports for the South Sudanese community.' },
    { id: 'g7', name: 'Faith & Fellowship', members: 1560, description: 'A space for spiritual growth and connection within our community.' },
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
  plus: { name: 'JuNubin+', monthlyPrice: '$9.99', features: ['Unlimited Likes', 'Unlimited Rewinds', 'Read Receipts'] },
  junub: { name: 'Junub', monthlyPrice: '$19.99', features: ['All JuNubin+ features', 'See Who Likes You', '1 Free Spotlight/month', 'Diaspora Connect', 'Advanced Filters', 'Incognito Mode'] },
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
export const mockComments = {
  post1: [
    { id: 'c1', user: { name: 'Makuei', avatar: AVATARS.p11 }, text: 'This was such an amazing night!', time: '1h ago', likes: 5 },
    { id: 'c2', user: { name: 'Achol', avatar: AVATARS.p9 }, text: 'Wish I could have been there', time: '1h ago', likes: 2 },
    { id: 'c3', user: { name: 'Akuol', avatar: AVATARS.p10 }, text: 'The food was incredible', time: '45m ago', likes: 8 },
    { id: 'c4', user: { name: 'Akech', avatar: AVATARS.p6 }, text: 'Next time we need to make it even bigger!', time: '30m ago', likes: 3 },
  ],
  post2: [
    { id: 'c1', user: { name: 'Nyandeng', avatar: AVATARS.p7 }, text: 'Try Mama Nyandeng\'s kitchen on Greenville Ave!', time: '4h ago', likes: 12 },
    { id: 'c2', user: { name: 'Atem', avatar: AVATARS.p12 }, text: 'Welcome to DFW!', time: '3h ago', likes: 4 },
    { id: 'c3', user: { name: 'Abuk', avatar: AVATARS.p2 }, text: 'There\'s a great one in Irving too', time: '2h ago', likes: 6 },
  ],
  post3: [
    { id: 'c1', user: { name: 'Adau', avatar: AVATARS.p1 }, text: 'Happy Independence Day!', time: '7h ago', likes: 15 },
    { id: 'c2', user: { name: 'Garang', avatar: AVATARS.p13 }, text: 'Proud to be Junub!', time: '6h ago', likes: 20 },
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
