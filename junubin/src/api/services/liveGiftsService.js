// Live + chat gift events — server-backed earnings ledger.
//
// Replaces the local-state-only flow where gift coins accumulated in
// React state during a live stream and vanished on stream end. Every
// gift sent (live OR in-chat) now writes a row to `LiveGiftEvent`;
// the 00019 trigger keeps `User.totalGiftCoinsReceived` in sync so
// Profile / earnings sheet can render the running total without a
// sum query.
//
// Cash-out itself remains a "coming soon" alert — that's a separate
// ticket. This module only persists the data.

import { supabase } from '../../config/supabase';

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `lg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Resolve the caller's app User.id from their auth session. Returns
 * null if unauthenticated. Mirrors the helper in postService so callers
 * can decide whether to throw or silently no-op.
 */
async function resolveAppUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  return appUser?.id || null;
}

/**
 * Record a single gift transaction. Resolves the giver from the auth
 * session and INSERTs a `LiveGiftEvent` row; the 00019 trigger bumps
 * the host's `totalGiftCoinsReceived`. Returns the inserted row.
 *
 * Throws on auth failure so the caller can surface the error or fall
 * back to a local-only bump. Callers should still update local UI
 * state for immediate feedback — the persisted row is the source of
 * truth across screens, but the network round-trip shouldn't gate the
 * floating gift animation.
 */
export async function recordLiveGift({ hostUserId, giftType, coinAmount, context = 'live' }) {
  if (!hostUserId) throw new Error('hostUserId required');
  if (!giftType) throw new Error('giftType required');
  if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
    throw new Error('coinAmount must be a positive number');
  }
  if (context !== 'live' && context !== 'chat') {
    throw new Error('context must be "live" or "chat"');
  }

  const giverUserId = await resolveAppUserId();
  if (!giverUserId) throw new Error('Not authenticated');

  const row = {
    id: makeId(),
    hostUserId,
    giverUserId,
    giftType,
    coinAmount,
    context,
  };

  const { data, error } = await supabase
    .from('LiveGiftEvent')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Read the running gift total for the given user (or auth user when no
 * arg is passed). Used by Profile screen + GoLive earnings sheet to
 * show "total coins received" without scanning the ledger.
 *
 * Returns { totalCoins } — defaults to 0 if the row can't be read
 * (unauthenticated viewer, etc.) so callers can render confidently
 * without null-guarding.
 */
export async function getEarningsSummary(userId) {
  let targetId = userId;
  if (!targetId) {
    targetId = await resolveAppUserId();
    if (!targetId) return { totalCoins: 0 };
  }

  const { data, error } = await supabase
    .from('User')
    .select('totalGiftCoinsReceived')
    .eq('id', targetId)
    .maybeSingle();
  if (error) throw error;
  return { totalCoins: data?.totalGiftCoinsReceived || 0 };
}
