// AnaJunubin — Offline Action Queue
// Queues actions while offline, processes them when connectivity is restored.

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@haboba_offline_queue';

export async function enqueueAction(action) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ ...action, queuedAt: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function processQueue(handler) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (queue.length === 0) return;

    const failed = [];
    for (const action of queue) {
      try {
        await handler(action);
      } catch {
        failed.push(action);
      }
    }

    if (failed.length > 0) {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failed));
    } else {
      await AsyncStorage.removeItem(QUEUE_KEY);
    }
  } catch {}
}

export async function getQueueLength() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw).length : 0;
  } catch {
    return 0;
  }
}
