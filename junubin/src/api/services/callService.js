// JuNubin — Call Signaling Service
//
// Broadcasts call lifecycle events between users over Supabase Realtime
// (`calls:<userId>` channels). Each event is a `broadcast` message — no DB
// row is required for live signaling, keeping latency low.
//
// Lifecycle:
//   1. Caller emits `invite`     → receiver's channel
//   2. Receiver emits `accept`   → caller's channel
//      OR             `decline` → caller's channel
//   3. Either side emits `end`   → the peer's channel
//
// Each event carries a stable `callId` so both sides can correlate state.
//
// When a real WebRTC SDK is added (e.g. react-native-webrtc + a Daily/LiveKit
// signaling server), the same channel can carry `offer`/`answer`/`ice` events
// — the surface here is intentionally extensible.

import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALL_LOG_KEY = '@junubin_call_log';
const MAX_LOG_ENTRIES = 100;

const channelKey = (userId) => `calls:${userId}`;

/**
 * Subscribe to incoming call events for a user. Returns the channel so the
 * caller can later remove it. Pass per-event handlers as the second argument.
 */
export function subscribeToCalls(userId, handlers = {}) {
  if (!userId) return null;
  const channel = supabase.channel(channelKey(userId));

  if (handlers.onInvite) {
    channel.on('broadcast', { event: 'invite' }, (msg) => handlers.onInvite(msg.payload));
  }
  if (handlers.onAccept) {
    channel.on('broadcast', { event: 'accept' }, (msg) => handlers.onAccept(msg.payload));
  }
  if (handlers.onDecline) {
    channel.on('broadcast', { event: 'decline' }, (msg) => handlers.onDecline(msg.payload));
  }
  if (handlers.onEnd) {
    channel.on('broadcast', { event: 'end' }, (msg) => handlers.onEnd(msg.payload));
  }

  channel.subscribe();
  return channel;
}

export function unsubscribe(channel) {
  if (channel) {
    try {
      supabase.removeChannel(channel);
    } catch {
      // best-effort cleanup
    }
  }
}

async function sendTo(userId, event, payload) {
  if (!userId) return;
  const channel = supabase.channel(channelKey(userId));
  await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event, payload }).finally(() => {
          supabase.removeChannel(channel);
          resolve();
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        supabase.removeChannel(channel);
        resolve();
      }
    });
  });
}

export const sendInvite = (toUserId, payload) => sendTo(toUserId, 'invite', payload);
export const sendAccept = (toUserId, payload) => sendTo(toUserId, 'accept', payload);
export const sendDecline = (toUserId, payload) => sendTo(toUserId, 'decline', payload);
export const sendEnd = (toUserId, payload) => sendTo(toUserId, 'end', payload);

/**
 * Persist a call lifecycle event. Writes through the Supabase `Call` table
 * when the user is authenticated AND the row makes sense to commit (final
 * states only — we don't store transient `dialing` rows).
 *
 * Always also writes to a local AsyncStorage cache so offline call history
 * stays available and so unauthenticated/dev sessions still work.
 */
async function getMyAppUserId() {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const { data: appUser } = await supabase
      .from('User')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();
    return appUser?.id || null;
  } catch {
    return null;
  }
}

const FINAL_STATUSES = new Set(['completed', 'declined', 'missed', 'cancelled', 'answered']);

export async function recordCall(entry) {
  // Local cache first — fast, always succeeds.
  try {
    const raw = await AsyncStorage.getItem(CALL_LOG_KEY);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({ ...entry, recordedAt: Date.now() });
    await AsyncStorage.setItem(CALL_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
  } catch {
    // best-effort
  }

  // DB write — only for terminal states + authenticated users.
  if (!FINAL_STATUSES.has(entry.status) || !entry.callId) return;
  try {
    const myId = await getMyAppUserId();
    if (!myId || !entry.peer?.id) return;
    const callerId = entry.direction === 'outgoing' ? myId : entry.peer.id;
    const peerId = entry.direction === 'outgoing' ? entry.peer.id : myId;
    await supabase.from('Call').upsert({
      id: entry.callId,
      callerId,
      peerId,
      callType: entry.callType || 'voice',
      status: entry.status,
      durationSeconds: entry.durationSeconds || 0,
      conversationId: entry.conversationId || null,
      endedAt: new Date().toISOString(),
    });
  } catch {
    // RLS or network failure — local cache is enough to keep history visible.
  }
}

/**
 * Read call history. Tries the DB first (authoritative + cross-device);
 * falls back to AsyncStorage if the DB call fails or returns nothing.
 */
export async function getCallLog() {
  try {
    const myId = await getMyAppUserId();
    if (myId) {
      const { data, error } = await supabase
        .from('Call')
        .select('*, peer:User!peerId(id, displayName, photos:Photo(url, sortOrder))')
        .or(`callerId.eq.${myId},peerId.eq.${myId}`)
        .order('createdAt', { ascending: false })
        .limit(MAX_LOG_ENTRIES);
      if (!error && Array.isArray(data) && data.length) return data;
    }
  } catch {
    // fall through to local cache
  }
  try {
    const raw = await AsyncStorage.getItem(CALL_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function newCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
