// JuNubin — Connection Service
//
// The social pivot's replacement for match state. A "connection" is a
// mutual follow: I follow you and you follow me. There is no swipe, no
// like quota and no reciprocity gate — following is one-sided and
// immediate, and the connection forms when the other side follows back.
//
// Messaging permission is deliberately separate from connection state:
// you may DM someone you're connected to, OR someone whose message
// request you accepted (either direction). Everyone else has to send a
// request first — see messageRequestService.
import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';
import { followUser, unfollowUser } from './followService';

/**
 * Get the current authenticated user's app-level ID.
 * Mirrors the helper in followService — kept local so this module has
 * no circular dependency beyond the two follow actions it delegates.
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
 * Read both follow edges between me and `targetUserId` in one query.
 * Returns { following, followedBy }.
 */
async function readFollowEdges(myId, targetUserId) {
  const { data, error } = await supabase
    .from('Follow')
    .select('followerId, followingId')
    .or(
      `and(followerId.eq.${myId},followingId.eq.${targetUserId}),and(followerId.eq.${targetUserId},followingId.eq.${myId})`
    );

  if (error) throw error;
  const edges = data || [];
  return {
    following: edges.some((e) => e.followerId === myId),
    followedBy: edges.some((e) => e.followerId === targetUserId),
  };
}

/**
 * Full relationship state with one other user.
 *
 * @returns {Promise<{
 *   following: boolean,
 *   followedBy: boolean,
 *   isConnected: boolean,
 *   requestStatus: 'none'|'pending_out'|'pending_in'|'accepted'|'declined',
 * }>}
 *
 * `requestStatus` collapses the MessageRequest row (which can exist in
 * either direction) into one value the profile header can switch on:
 *   pending_out  I asked, waiting on them
 *   pending_in   they asked, waiting on me
 *   accepted     a conversation exists
 *   declined     someone said no
 */
export async function getConnectionState(targetUserId) {
  if (!targetUserId) {
    return { following: false, followedBy: false, isConnected: false, requestStatus: 'none' };
  }
  const myId = await getMyUserId();
  if (myId === targetUserId) {
    return { following: false, followedBy: false, isConnected: false, requestStatus: 'none' };
  }

  const [edges, requestRow] = await Promise.all([
    readFollowEdges(myId, targetUserId),
    supabase
      .from('MessageRequest')
      .select('fromUserId, toUserId, status')
      .or(
        `and(fromUserId.eq.${myId},toUserId.eq.${targetUserId}),and(fromUserId.eq.${targetUserId},toUserId.eq.${myId})`
      )
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // A missing MessageRequest table (migration not pushed yet) must not
  // take the whole profile header down — degrade to 'none'.
  const req = requestRow?.error ? null : requestRow?.data;

  let requestStatus = 'none';
  if (req) {
    if (req.status === 'pending') {
      requestStatus = req.fromUserId === myId ? 'pending_out' : 'pending_in';
    } else if (req.status === 'accepted' || req.status === 'declined') {
      requestStatus = req.status;
    }
  }

  return {
    following: edges.following,
    followedBy: edges.followedBy,
    isConnected: edges.following && edges.followedBy,
    requestStatus,
  };
}

/**
 * Follow the target. Returns the post-action connection state so the
 * caller can flip straight to "Connected" when the follow was mutual.
 */
export async function connect(targetUserId) {
  if (!targetUserId) throw new Error('targetUserId required');
  await followUser(targetUserId);

  const myId = await getMyUserId();
  const edges = await readFollowEdges(myId, targetUserId);
  return { following: true, isConnected: edges.following && edges.followedBy };
}

/**
 * Unfollow the target. The other side's follow edge is left alone —
 * disconnecting is not a mutual action.
 */
export async function disconnect(targetUserId) {
  if (!targetUserId) throw new Error('targetUserId required');
  return unfollowUser(targetUserId);
}

/**
 * Everyone I'm mutually following, as normalized profiles.
 *
 * Two queries rather than a join because Follow has no self-join in
 * PostgREST: first the people I follow, then which of those follow me
 * back (that second query carries the User payload).
 */
export async function getConnections() {
  const myId = await getMyUserId();

  const { data: myFollowing, error: followingErr } = await supabase
    .from('Follow')
    .select('followingId')
    .eq('followerId', myId);
  if (followingErr) throw followingErr;
  if (!myFollowing?.length) return [];

  const followingIds = myFollowing.map((f) => f.followingId);

  const { data: mutuals, error: mutualsErr } = await supabase
    .from('Follow')
    .select(`
      followerId, createdAt,
      follower:User!followerId(
        id, displayName, dateOfBirth, isVerified, city, countryCode, gender, lastActiveAt,
        photos:Photo(*),
        profile:Profile(*)
      )
    `)
    .eq('followingId', myId)
    .in('followerId', followingIds)
    .order('createdAt', { ascending: false });
  if (mutualsErr) throw mutualsErr;

  return (mutuals || [])
    .map((f) => normalizeProfile(f.follower))
    .filter(Boolean);
}

/**
 * Can I open a chat with this person right now, without sending a
 * request first?
 *
 * True when we're connected (mutual follow) OR an accepted
 * MessageRequest exists in either direction. Note this is a UX gate,
 * not the security boundary — the real enforcement is the Message
 * INSERT policy (00033), which requires ConversationMember membership
 * and honours Block.
 */
export async function canMessageDirectly(targetUserId) {
  if (!targetUserId) return false;
  const myId = await getMyUserId();
  if (myId === targetUserId) return false;

  const edges = await readFollowEdges(myId, targetUserId);
  if (edges.following && edges.followedBy) return true;

  const { data, error } = await supabase
    .from('MessageRequest')
    .select('id')
    .eq('status', 'accepted')
    .or(
      `and(fromUserId.eq.${myId},toUserId.eq.${targetUserId}),and(fromUserId.eq.${targetUserId},toUserId.eq.${myId})`
    )
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
