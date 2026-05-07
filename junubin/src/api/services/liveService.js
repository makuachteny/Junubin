// Live request-to-join — backed by the LiveJoinRequest table (00012).
//
// Flow:
//   1. Viewer calls requestJoin(hostUserId) → row inserted (status=pending)
//   2. Host's GoLiveScreen subscribes to inserts → shows accept/decline UI
//   3. Host calls respondToRequest(requestId, 'accepted'|'declined')
//   4. Viewer subscribes to UPDATE on the row → flips local UI
//
// We keep the request row around so the host can inspect history and
// either side can re-poll on reconnect. cancelRequest() flips the row
// to 'expired' rather than DELETE-ing so the host's subscription
// handler can treat all terminal states uniformly.

import { supabase } from '../../config/supabase';

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `lj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function currentAppUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');
  const { data: appUser, error } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (error) throw error;
  return appUser.id;
}

/**
 * Viewer asks the host for permission to join the stream as a co-host.
 * Idempotent on (hostId, viewerId) — repeat taps re-use the existing row
 * and flip its status back to pending if it had been declined/expired.
 */
export async function requestJoin(hostUserId) {
  const viewerId = await currentAppUserId();

  const { data: existing } = await supabase
    .from('LiveJoinRequest')
    .select('id, status')
    .eq('hostId', hostUserId)
    .eq('viewerId', viewerId)
    .maybeSingle();

  if (existing) {
    if (existing.status !== 'pending') {
      const { error } = await supabase
        .from('LiveJoinRequest')
        .update({ status: 'pending', respondedAt: null })
        .eq('id', existing.id);
      if (error) throw error;
    }
    return { id: existing.id, hostId: hostUserId, viewerId, status: 'pending' };
  }

  const id = makeId();
  const { data, error } = await supabase
    .from('LiveJoinRequest')
    .insert({ id, hostId: hostUserId, viewerId, status: 'pending' })
    .select('id, hostId, viewerId, status')
    .single();
  if (error) throw error;
  return data;
}

export async function cancelRequest(requestId) {
  const { error } = await supabase
    .from('LiveJoinRequest')
    .update({ status: 'expired', respondedAt: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
  return { ok: true };
}

export async function respondToRequest(requestId, status) {
  if (status !== 'accepted' && status !== 'declined') {
    throw new Error(`Invalid status: ${status}`);
  }
  const { error } = await supabase
    .from('LiveJoinRequest')
    .update({ status, respondedAt: new Date().toISOString() })
    .eq('id', requestId);
  if (error) throw error;
  return { ok: true };
}

/**
 * Host-side: subscribe to incoming join requests for *this* host.
 * Returns the channel so the caller can clean up. The handler fires for
 * each new pending row and again whenever a row's status changes (so
 * the host can dismiss accepted/declined items from their tray).
 */
export function subscribeToHostRequests(hostUserId, onChange) {
  const channel = supabase
    .channel(`live-requests:host:${hostUserId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'LiveJoinRequest', filter: `hostId=eq.${hostUserId}` },
      (payload) => {
        onChange?.(payload.new || payload.old, payload.eventType);
      },
    )
    .subscribe();
  return channel;
}

/**
 * Viewer-side: subscribe to status changes on a specific request row so
 * we know the moment the host accepts or declines.
 */
export function subscribeToRequest(requestId, onChange) {
  const channel = supabase
    .channel(`live-requests:row:${requestId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'LiveJoinRequest', filter: `id=eq.${requestId}` },
      (payload) => onChange?.(payload.new),
    )
    .subscribe();
  return channel;
}
