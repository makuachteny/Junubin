// Client-side helper to mint Daily.co rooms via the project's Edge Function.
// The Edge Function (`daily-create-room`) holds the secret Daily API key
// and signs the per-meeting tokens. Client only ever sees the room URL +
// a short-lived participant token.

import { supabase } from '../../config/supabase';

/**
 * Create or fetch a Daily room for a given purpose.
 *
 * @param {Object} opts
 * @param {'call'|'live'}        opts.kind         purpose of the room
 * @param {string}               opts.context      stable id — for calls,
 *   the conversationId (so the same chat keeps reusing one room); for
 *   live broadcasts, the host's userId.
 * @param {boolean}              [opts.isOwner]    true for callers /
 *   broadcasters; gets a token with `is_owner` so they can mute others
 *   or end the room.
 * @returns {Promise<{ url: string, token: string, room: string }>}
 */
export async function getOrCreateDailyRoom({ kind, context, isOwner = false }) {
  if (!kind || !context) throw new Error('kind + context required');
  const { data, error } = await supabase.functions.invoke('daily-create-room', {
    body: { kind, context, isOwner },
  });
  if (error) throw new Error(error.message || 'Could not create call room');
  if (!data?.url) throw new Error('Room URL missing from response');
  return data;
}
