import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  mood: '@junubin_interactive_mood',
  seasonMode: '@junubin_season_mode',
  friendLayer: '@junubin_friend_layer',
  weeklyChallenges: '@junubin_weekly_challenges',
  liveSpark: '@junubin_live_spark',
  storyThreads: '@junubin_story_threads',
  eventRooms: '@junubin_event_rooms',
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
    return readJson(`@junubin_custom_game_${gameType}`, []);
  },
  async setCustomQuestions(gameType, questions) {
    return writeJson(`@junubin_custom_game_${gameType}`, questions);
  },
  async getActiveGames(conversationId) {
    return readJson(`@junubin_active_games_${conversationId}`, []);
  },
  async setActiveGames(conversationId, gamesArray) {
    return writeJson(`@junubin_active_games_${conversationId}`, gamesArray);
  },
  async clearActiveGames(conversationId) {
    try {
      await AsyncStorage.removeItem(`@junubin_active_games_${conversationId}`);
    } catch {}
  },
  // ── Match Mission state ──
  // Keyed by conversationId so each thread tracks its own intro / question
  // / response progress. Default shape matches the in-memory state used by
  // ChatScreen so a missing record reads like a fresh thread.
  async getMatchMission(conversationId) {
    return readJson(`@junubin_match_mission_${conversationId}`, {
      intro: false,
      question: false,
      response: false,
    });
  },
  async setMatchMission(conversationId, state) {
    return writeJson(`@junubin_match_mission_${conversationId}`, state);
  },
  // Per-conversation flag for "user dismissed the Match Mission card".
  // Separate key so re-enabling the card later doesn't wipe progress.
  async getMissionDismissed(conversationId) {
    return readJson(`@junubin_mission_dismissed_${conversationId}`, false);
  },
  async setMissionDismissed(conversationId, dismissed) {
    return writeJson(`@junubin_mission_dismissed_${conversationId}`, dismissed);
  },
};
