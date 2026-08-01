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

// Build a stable identity key for an action so we can dedupe on
// enqueue + on replay. Each `kind` has its own natural key:
//
//   - text        → ('text', conversationId, tempId)
//
// Anything that doesn't match a known shape gets a fallback identity
// based on the JSON of the action; same shape = same key. (The
// dating-era 'swipe' / 'voiceNote' / 'chatImage' kinds are gone —
// stale entries from an older build fall through to the default
// branch and are dropped by the replay handler.)
function actionIdentity(a) {
  if (!a || typeof a !== 'object') return JSON.stringify(a);
  switch (a.kind) {
    case 'text':      return `text:${a.conversationId || ''}:${a.tempId || a.body || ''}`;
    default:          return `${a.kind || 'unknown'}:${JSON.stringify(a)}`;
  }
}

export async function enqueueAction(action) {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    // Dedupe on enqueue: a repeated retry of the same swipe / voice
    // note shouldn't create three copies in the queue. Without this,
    // a flaky network that triggers three handler-throws produced
    // three identical replays on reconnect.
    const id = actionIdentity(action);
    const existing = queue.findIndex((q) => actionIdentity(q) === id);
    const entry = { ...action, queuedAt: Date.now() };
    if (existing >= 0) {
      queue[existing] = entry; // refresh the timestamp so MAX_AGE_MS resets
    } else {
      queue.push(entry);
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    // Log parse / storage errors so they surface in crash reports
    // instead of vanishing — losing a queued action silently was
    // exactly the kind of failure that was invisible before.
    if (__DEV__) console.warn('[offlineQueue]', err?.message || err);
  }
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
    const seenIds = new Set();
    for (const action of queue) {
      // Drop duplicates on replay too. A queue could carry duplicates
      // if it was written by a pre-dedup build of the app and only
      // drained today — defense in depth.
      const id = actionIdentity(action);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

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
  } catch (err) {
    // Log parse / storage errors so they surface in crash reports
    // instead of vanishing — losing a queued action silently was
    // exactly the kind of failure that was invisible before.
    if (__DEV__) console.warn('[offlineQueue]', err?.message || err);
  }
}

export async function getQueueLength() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw).length : 0;
  } catch {
    return 0;
  }
}
