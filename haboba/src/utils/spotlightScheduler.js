// AnaJunubin — Spotlight Scheduler (7-day cooldown)
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@haboba_spotlight_last';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function canShowSpotlight() {
  try {
    const last = await AsyncStorage.getItem(KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) >= COOLDOWN_MS;
  } catch {
    return true;
  }
}

export async function markSpotlightShown() {
  try {
    await AsyncStorage.setItem(KEY, Date.now().toString());
  } catch {}
}
