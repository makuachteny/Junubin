// AnaJunubin — App Store Review Prompt
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const MATCH_KEY = '@haboba_review_matches';
const MSG_KEY = '@haboba_review_messages';
const PROMPTED_KEY = '@haboba_review_prompted';

export async function trackMatch() {
  try {
    const raw = await AsyncStorage.getItem(MATCH_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(MATCH_KEY, count.toString());
    if (count >= 5) maybePrompt();
  } catch {}
}

export async function trackMessage() {
  try {
    const raw = await AsyncStorage.getItem(MSG_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(MSG_KEY, count.toString());
    if (count >= 20) maybePrompt();
  } catch {}
}

async function maybePrompt() {
  try {
    const prompted = await AsyncStorage.getItem(PROMPTED_KEY);
    if (prompted) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    await StoreReview.requestReview();
    await AsyncStorage.setItem(PROMPTED_KEY, 'true');
  } catch {}
}
