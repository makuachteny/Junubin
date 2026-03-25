// AnaJunubin — In-Chat Games Catalog & Question Banks

export const GAME_TYPES = {
  this_or_that: 'this_or_that',
  trivia: 'trivia',
  vibe_check: 'vibe_check',
  would_you_rather: 'would_you_rather',
};

export const GAME_CATALOG = [
  {
    type: GAME_TYPES.this_or_that,
    name: 'This or That',
    emoji: '\u26A1',
    tagline: 'Quick picks, big vibes',
    color: '#009739',
    icon: 'flash',
    roundCount: 5,
  },
  {
    type: GAME_TYPES.trivia,
    name: 'Trivia',
    emoji: '\uD83E\uDDE0',
    tagline: 'Test your knowledge',
    color: '#0047AB',
    icon: 'school',
    roundCount: 5,
  },
  {
    type: GAME_TYPES.vibe_check,
    name: 'Vibe Check',
    emoji: '\uD83D\uDD2E',
    tagline: 'How well do you match?',
    color: '#A80D1E',
    icon: 'heart-circle',
    roundCount: 5,
  },
  {
    type: GAME_TYPES.would_you_rather,
    name: 'Would You Rather',
    emoji: '\uD83E\uDD14',
    tagline: 'Tough calls, real talk',
    color: '#00BCD4',
    icon: 'swap-horizontal',
    roundCount: 5,
  },
];

export const THIS_OR_THAT_QUESTIONS = [
  { id: 'tot1', optionA: 'Juba nightlife', optionB: 'Quiet evening in' },
  { id: 'tot2', optionA: 'Afrobeats', optionB: 'R&B' },
  { id: 'tot3', optionA: 'Rooftop dinner', optionB: 'Street food run' },
  { id: 'tot4', optionA: 'Morning person', optionB: 'Night owl' },
  { id: 'tot5', optionA: 'Beach day', optionB: 'Mountain hike' },
  { id: 'tot6', optionA: 'Cook together', optionB: 'Order in' },
  { id: 'tot7', optionA: 'Call first', optionB: 'Text first' },
  { id: 'tot8', optionA: 'City life', optionB: 'Village vibes' },
  { id: 'tot9', optionA: 'Road trip', optionB: 'Fly there' },
  { id: 'tot10', optionA: 'Amala & ewedu', optionB: 'Kisra & mulah' },
  { id: 'tot11', optionA: 'Live concert', optionB: 'Movie night' },
  { id: 'tot12', optionA: 'Big group hang', optionB: 'One-on-one' },
  { id: 'tot13', optionA: 'Funny date', optionB: 'Deep conversation' },
  { id: 'tot14', optionA: 'Bold fashion', optionB: 'Minimalist style' },
  { id: 'tot15', optionA: 'Spontaneous trip', optionB: 'Plan everything' },
];

export const TRIVIA_QUESTIONS = [
  { id: 'tr1', question: 'When did South Sudan gain independence?', options: ['2005', '2011', '2013', '2009'], correctIndex: 1 },
  { id: 'tr2', question: 'What is the capital of South Sudan?', options: ['Malakal', 'Wau', 'Juba', 'Bor'], correctIndex: 2 },
  { id: 'tr3', question: 'The White Nile flows through South Sudan. Where does it originate?', options: ['Lake Victoria', 'Lake Chad', 'Lake Turkana', 'Lake Tana'], correctIndex: 0 },
  { id: 'tr4', question: 'How many states does South Sudan have?', options: ['5', '10', '28', '32'], correctIndex: 1 },
  { id: 'tr5', question: 'Which ethnic group is the largest in South Sudan?', options: ['Nuer', 'Shilluk', 'Dinka', 'Azande'], correctIndex: 2 },
  { id: 'tr6', question: 'What is South Sudan\'s official language?', options: ['Arabic', 'Dinka', 'English', 'Swahili'], correctIndex: 2 },
  { id: 'tr7', question: 'Boma National Park is known for hosting one of the largest...', options: ['Elephant herds', 'Antelope migrations', 'Lion prides', 'Hippo pods'], correctIndex: 1 },
  { id: 'tr8', question: 'Which river forms a major part of the Sudd wetland?', options: ['Blue Nile', 'White Nile', 'Congo River', 'Sobat River'], correctIndex: 1 },
  { id: 'tr9', question: 'What traditional South Sudanese instrument is a thumb piano?', options: ['Djembe', 'Kalimba', 'Rababa', 'Nyatiti'], correctIndex: 1 },
  { id: 'tr10', question: 'South Sudan\'s independence day is celebrated on...', options: ['January 9', 'July 9', 'March 21', 'October 1'], correctIndex: 1 },
  { id: 'tr11', question: 'Which South Sudanese runner was an Olympic athlete?', options: ['Guor Marial', 'Yiech Pur Biel', 'Manute Bol', 'Luol Deng'], correctIndex: 0 },
  { id: 'tr12', question: 'What is kisra traditionally made from?', options: ['Wheat', 'Rice', 'Sorghum', 'Corn'], correctIndex: 2 },
  { id: 'tr13', question: 'The Sudd is one of the world\'s largest...', options: ['Deserts', 'Wetlands', 'Forests', 'Mountain ranges'], correctIndex: 1 },
  { id: 'tr14', question: 'Which city is the second-largest in South Sudan?', options: ['Bor', 'Malakal', 'Wau', 'Rumbek'], correctIndex: 2 },
  { id: 'tr15', question: 'What does "Junub" mean in Arabic?', options: ['North', 'South', 'East', 'Peace'], correctIndex: 1 },
  { id: 'tr16', question: 'Which South Sudanese NBA player became famous for shot-blocking?', options: ['Luol Deng', 'Manute Bol', 'Thon Maker', 'Wenyen Gabriel'], correctIndex: 1 },
  { id: 'tr17', question: 'What type of climate does most of South Sudan have?', options: ['Arid desert', 'Tropical', 'Mediterranean', 'Tundra'], correctIndex: 1 },
  { id: 'tr18', question: 'The Comprehensive Peace Agreement was signed in which year?', options: ['2000', '2003', '2005', '2008'], correctIndex: 2 },
  { id: 'tr19', question: 'Which lake borders South Sudan to the south?', options: ['Lake Victoria', 'Lake Albert', 'Lake Turkana', 'Lake Kyoga'], correctIndex: 1 },
  { id: 'tr20', question: 'What is a traditional Dinka cattle camp called?', options: ['Luak', 'Boma', 'Tukul', 'Manyatta'], correctIndex: 0 },
];

export const VIBE_CHECK_QUESTIONS = [
  { id: 'vc1', question: 'Ideal weekend?', optionA: 'Adventure outside', optionB: 'Cozy day in' },
  { id: 'vc2', question: 'Love language?', optionA: 'Quality time', optionB: 'Words of affirmation' },
  { id: 'vc3', question: 'Energy in a relationship?', optionA: 'Playful & fun', optionB: 'Deep & soulful' },
  { id: 'vc4', question: 'Social style?', optionA: 'Life of the party', optionB: 'Small circle only' },
  { id: 'vc5', question: 'Communication?', optionA: 'Talk every day', optionB: 'Space is healthy' },
  { id: 'vc6', question: 'Conflict style?', optionA: 'Talk it out now', optionB: 'Cool off first' },
  { id: 'vc7', question: 'Future planning?', optionA: 'Live in the moment', optionB: 'Plan ahead' },
  { id: 'vc8', question: 'Date vibe?', optionA: 'Surprise me', optionB: 'I like knowing the plan' },
  { id: 'vc9', question: 'Music taste?', optionA: 'Always exploring new', optionB: 'Loyal to favorites' },
  { id: 'vc10', question: 'Morning routine?', optionA: 'Up and moving', optionB: 'Slow and steady' },
];

export const WOULD_YOU_RATHER_QUESTIONS = [
  { id: 'wyr1', optionA: 'Have the perfect playlist for every mood', optionB: 'Always know the best restaurant nearby' },
  { id: 'wyr2', optionA: 'Travel the world for a year', optionB: 'Get your dream home right now' },
  { id: 'wyr3', optionA: 'Read your partner\'s mind for a day', optionB: 'Have them read yours' },
  { id: 'wyr4', optionA: 'Be famous in your city', optionB: 'Be rich but anonymous' },
  { id: 'wyr5', optionA: 'Only eat Juba street food forever', optionB: 'Only eat home-cooked meals forever' },
  { id: 'wyr6', optionA: 'Have a perfect memory', optionB: 'Be able to forget anything on command' },
  { id: 'wyr7', optionA: 'Live without music', optionB: 'Live without movies' },
  { id: 'wyr8', optionA: 'Always be 10 minutes early', optionB: 'Always arrive perfectly on time' },
  { id: 'wyr9', optionA: 'Know every language', optionB: 'Play every instrument' },
  { id: 'wyr10', optionA: 'Have a rewind button for life', optionB: 'Have a pause button' },
  { id: 'wyr11', optionA: 'Date someone funnier than you', optionB: 'Date someone smarter than you' },
  { id: 'wyr12', optionA: 'Live by the Nile', optionB: 'Live in the mountains' },
  { id: 'wyr13', optionA: 'Never have to sleep', optionB: 'Never have to eat' },
  { id: 'wyr14', optionA: 'Always have Wi-Fi everywhere', optionB: 'Always have free flights' },
  { id: 'wyr15', optionA: 'Have one wish granted now', optionB: 'Have three wishes granted in 10 years' },
];

export function getRandomQuestions(type, count, customQuestions = []) {
  let bank;
  switch (type) {
    case GAME_TYPES.this_or_that:
      bank = THIS_OR_THAT_QUESTIONS;
      break;
    case GAME_TYPES.trivia:
      bank = TRIVIA_QUESTIONS;
      break;
    case GAME_TYPES.vibe_check:
      bank = VIBE_CHECK_QUESTIONS;
      break;
    case GAME_TYPES.would_you_rather:
      bank = WOULD_YOU_RATHER_QUESTIONS;
      break;
    default:
      return [];
  }
  const merged = [...bank, ...customQuestions];
  const shuffled = merged.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
