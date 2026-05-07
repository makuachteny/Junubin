// JuNubin — Offline Action Queue
// Queues actions while offline, processes them when connectivity
// returns. The queue is best-effort: dating actions that have lost
// their context (the user got banned, the recipient blocked them, the
// match was undone) shouldn't replay just because the queue knows how.
//
// The consumer of processQueue is expected to re-validate each action
// before applying it. To make that possible *and* safe by default,
// processQueue here:
//   1. Drops anything older than MAX_AGE_MS (default 24h) — better to
//      lose a swipe than to send one a day late.
//   2. Calls an optional `precheck(action)` before the handler. If
//      precheck returns falsy, the action is dropped silently.
//   3. Distinguishes "drop" from "fail-and-retry": handler-throwing
//      keeps the action; precheck-rejecting drops it permanently.

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@junubin_offline_queue';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h — dating actions stale fast

export async function enqueueAction(action) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ ...action, queuedAt: Date.now() });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function processQueue(handler, opts = {}) {
  const { precheck, maxAgeMs = MAX_AGE_MS } = opts;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (queue.length === 0) return;

    const cutoff = Date.now() - maxAgeMs;
    const failed = [];
    for (const action of queue) {
      // 1. Stale → drop, don't retry. Replaying a 25h-old swipe is
      //    worse than losing it.
      if (action.queuedAt && action.queuedAt < cutoff) continue;

      // 2. Precheck — eligibility / moderation gate. If the user got
      //    banned or restricted, or the action's target is now blocked
      //    in either direction, the consumer's precheck returns false
      //    and we drop the action permanently.
      if (precheck) {
        let allowed = true;
        try { allowed = await precheck(action); } catch { allowed = false; }
        if (!allowed) continue;
      }

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
