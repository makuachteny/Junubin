// JuNubin — Message Request Service
//
// A stranger can't DM you outright. They send a message request with a
// short note; you accept (which mints a real Conversation via the
// accept_message_request RPC) or decline. Backed by the MessageRequest
// table + RLS from 00047: both parties can read the row, only the
// sender inserts, only the recipient responds.
import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';

// Matches the Message sanitisation ceiling in chatService — a request
// note is a first impression, not an essay.
const MAX_MESSAGE_LENGTH = 500;

// The User payload each request row carries so the inbox can render a
// profile card without a second round trip.
const PARTY_COLUMNS = `
  id, displayName, dateOfBirth, isVerified, city, countryCode, gender, lastActiveAt,
  photos:Photo(*),
  profile:Profile(*)
`;

/**
 * Get the current authenticated user's app-level ID.
 */
async function getMyUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');
  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');
  return appUser.id;
}

/**
 * Send a message request.
 *
 * @returns {Promise<{ id: string, status: string }>}
 *
 * The unique index on (fromUserId, toUserId) means a second request to
 * the same person is a 23505. That's the anti-spam design, not an
 * error the user needs to see — we resolve the existing row and return
 * it so the UI just shows "Requested".
 */
export async function sendMessageRequest(toUserId, message) {
  if (!toUserId) throw new Error('toUserId required');
  const myId = await getMyUserId();
  if (myId === toUserId) throw new Error('Cannot message yourself');

  // Same stripping the chat path applies — the note renders as plain
  // text in the recipient's inbox.
  const sanitized = String(message || '')
    .replace(/<[^>]*>?/g, '')
    .replace(/&[a-z]+;/gi, '')
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);

  const { data, error } = await supabase
    .from('MessageRequest')
    .insert({ fromUserId: myId, toUserId, message: sanitized })
    .select('id, status')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('MessageRequest')
        .select('id, status')
        .eq('fromUserId', myId)
        .eq('toUserId', toUserId)
        .maybeSingle();
      if (existing) return { id: existing.id, status: existing.status };
    }
    throw error;
  }

  return { id: data.id, status: data.status };
}

/**
 * Requests sent TO me, newest first.
 * @returns {Promise<Array<{ id, message, createdAt, status, from }>>}
 */
export async function getIncomingRequests() {
  const myId = await getMyUserId();

  const { data, error } = await supabase
    .from('MessageRequest')
    .select(`
      id, message, status, createdAt, respondedAt, conversationId,
      from:User!fromUserId(${PARTY_COLUMNS})
    `)
    .eq('toUserId', myId)
    .order('createdAt', { ascending: false });

  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    message: r.message || '',
    createdAt: r.createdAt,
    status: r.status,
    conversationId: r.conversationId || null,
    from: normalizeProfile(r.from),
  }));
}

/**
 * Requests I sent, newest first.
 * @returns {Promise<Array<{ id, message, createdAt, status, to }>>}
 */
export async function getOutgoingRequests() {
  const myId = await getMyUserId();

  const { data, error } = await supabase
    .from('MessageRequest')
    .select(`
      id, message, status, createdAt, respondedAt, conversationId,
      to:User!toUserId(${PARTY_COLUMNS})
    `)
    .eq('fromUserId', myId)
    .order('createdAt', { ascending: false });

  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    message: r.message || '',
    createdAt: r.createdAt,
    status: r.status,
    conversationId: r.conversationId || null,
    to: normalizeProfile(r.to),
  }));
}

/**
 * Accept a request. Returns the conversation to open.
 *
 * All the work is server-side (accept_message_request, 00047): it
 * verifies we're the recipient, reuses an existing conversation with
 * this person if there is one, creates the Conversation +
 * ConversationMember rows otherwise, and flips the request — all in
 * one transaction. A double-tap is idempotent and returns the same
 * conversation id.
 *
 * @returns {Promise<{ conversationId: string }>}
 */
export async function acceptMessageRequest(requestId) {
  if (!requestId) throw new Error('requestId required');

  const { data, error } = await supabase.rpc('accept_message_request', {
    request_id: requestId,
  });

  if (error) throw error;
  if (!data) throw new Error('Could not open the conversation');
  return { conversationId: data };
}

/**
 * Decline a request. The row stays on the table (declined, not
 * deleted) so the unique index keeps the sender from re-sending.
 */
export async function declineMessageRequest(requestId) {
  if (!requestId) throw new Error('requestId required');
  const myId = await getMyUserId();

  const { error } = await supabase
    .from('MessageRequest')
    .update({ status: 'declined', respondedAt: new Date().toISOString() })
    .eq('id', requestId)
    .eq('toUserId', myId)
    .eq('status', 'pending');

  if (error) throw error;
  return { success: true };
}

/**
 * Badge count for the requests tab — pending incoming only.
 * Returns 0 rather than throwing so a nav badge never breaks the
 * screen it's attached to.
 */
export async function getIncomingRequestCount() {
  try {
    const myId = await getMyUserId();
    const { count, error } = await supabase
      .from('MessageRequest')
      .select('id', { count: 'exact', head: true })
      .eq('toUserId', myId)
      .eq('status', 'pending');
    if (error) throw error;
    return count || 0;
  } catch (err) {
    if (__DEV__) console.warn('[messageRequest] count failed:', err?.message || err);
    return 0;
  }
}
