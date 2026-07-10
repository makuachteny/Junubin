// AnaJunubin — Offline Cache with TTL
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportError } from './reportError';

const PREFIX = '@junubin_cache_';

export async function cacheGet(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (expiresAt && Date.now() > expiresAt) {
      AsyncStorage.removeItem(PREFIX + key).catch((err) => reportError('offlineCache.expire', err, { key }));
      return null;
    }
    return data;
  } catch (err) {
    reportError('offlineCache.get', err, { key });
    return null;
  }
}

export async function cacheSet(key, data, ttlMs = 300000) {
  try {
    const entry = { data, expiresAt: ttlMs ? Date.now() + ttlMs : null };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch (err) {
    reportError('offlineCache.set', err, { key });
  }
}

export async function cacheClear(key) {
  try {
    if (key) {
      await AsyncStorage.removeItem(PREFIX + key);
    } else {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(PREFIX));
      if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (err) {
    reportError('offlineCache.clear', err, { key });
  }
}
