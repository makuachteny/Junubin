import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  mood: '@haboba_interactive_mood',
  seasonMode: '@haboba_season_mode',
  friendLayer: '@haboba_friend_layer',
  weeklyChallenges: '@haboba_weekly_challenges',
  liveSpark: '@haboba_live_spark',
  storyThreads: '@haboba_story_threads',
  eventRooms: '@haboba_event_rooms',
};

const readJson = async (key, fallback) => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort local persistence
  }
};

export const interactiveStore = {
  keys: KEYS,
  async getMood() {
    return readJson(KEYS.mood, 'Open to chat');
  },
  async setMood(value) {
    return writeJson(KEYS.mood, value);
  },
  async getSeasonMode() {
    return readJson(KEYS.seasonMode, 'Festival');
  },
  async setSeasonMode(value) {
    return writeJson(KEYS.seasonMode, value);
  },
  async getFriendLayer() {
    return readJson(KEYS.friendLayer, true);
  },
  async setFriendLayer(value) {
    return writeJson(KEYS.friendLayer, value);
  },
  async getWeeklyChallenges() {
    return readJson(KEYS.weeklyChallenges, {});
  },
  async setWeeklyChallenges(value) {
    return writeJson(KEYS.weeklyChallenges, value);
  },
  async getLiveSpark() {
    return readJson(KEYS.liveSpark, { prompt: '', answer: '', updatedAt: 0 });
  },
  async setLiveSpark(value) {
    return writeJson(KEYS.liveSpark, value);
  },
  async getStoryThreads() {
    return readJson(KEYS.storyThreads, {});
  },
  async setStoryThreads(value) {
    return writeJson(KEYS.storyThreads, value);
  },
  async getEventRooms() {
    return readJson(KEYS.eventRooms, {});
  },
  async setEventRooms(value) {
    return writeJson(KEYS.eventRooms, value);
  },
  async getCustomQuestions(gameType) {
    return readJson(`@haboba_custom_game_${gameType}`, []);
  },
  async setCustomQuestions(gameType, questions) {
    return writeJson(`@haboba_custom_game_${gameType}`, questions);
  },
  async getActiveGames(conversationId) {
    return readJson(`@haboba_active_games_${conversationId}`, []);
  },
  async setActiveGames(conversationId, gamesArray) {
    return writeJson(`@haboba_active_games_${conversationId}`, gamesArray);
  },
  async clearActiveGames(conversationId) {
    try {
      await AsyncStorage.removeItem(`@haboba_active_games_${conversationId}`);
    } catch {}
  },
};
