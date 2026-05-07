// AnaJunubin — Follow Service
// Handles follow/unfollow, follower/following lists, friend detection (mutual follows)
import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';

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
 * Follow a user.
 */
export async function followUser(targetUserId) {
  const myId = await getMyUserId();
  if (myId === targetUserId) throw new Error('Cannot follow yourself');

  const { data, error } = await supabase
    .from('Follow')
    .insert({ followerId: myId, followingId: targetUserId })
    .select()
    .single();

  if (error) {
    // Duplicate follow — treat as success
    if (error.code === '23505') return { alreadyFollowing: true };
    throw error;
  }
  return data;
}

/**
 * Unfollow a user.
 */
export async function unfollowUser(targetUserId) {
  const myId = await getMyUserId();

  const { error } = await supabase
    .from('Follow')
    .delete()
    .eq('followerId', myId)
    .eq('followingId', targetUserId);

  if (error) throw error;
  return { success: true };
}

/**
 * Check if the current user is following a specific user.
 */
export async function isFollowing(targetUserId) {
  const myId = await getMyUserId();

  const { data, error } = await supabase
    .from('Follow')
    .select('id')
    .eq('followerId', myId)
    .eq('followingId', targetUserId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Check follow status for multiple users at once.
 * Returns a Set of user IDs that the current user is following.
 */
export async function checkFollowStatus(userIds) {
  if (!userIds.length) return new Set();
  const myId = await getMyUserId();

  const { data, error } = await supabase
    .from('Follow')
    .select('followingId')
    .eq('followerId', myId)
    .in('followingId', userIds);

  if (error) throw error;
  return new Set((data || []).map((f) => f.followingId));
}

/**
 * Check if two users mutually follow each other (friends).
 */
export async function areFriends(targetUserId) {
  const myId = await getMyUserId();

  const { data, error } = await supabase
    .from('Follow')
    .select('followerId, followingId')
    .or(
      `and(followerId.eq.${myId},followingId.eq.${targetUserId}),and(followerId.eq.${targetUserId},followingId.eq.${myId})`
    );

  if (error) throw error;
  return (data || []).length === 2;
}

/**
 * Get followers of a user (people who follow them).
 * Returns profiles with follow metadata.
 */
export async function getFollowers(userId) {
  const { data, error } = await supabase
    .from('Follow')
    .select(`
      id, createdAt,
      follower:User!followerId(
        id, displayName, dateOfBirth, isVerified, city, gender,
        photos:Photo(*),
        profile:Profile(*)
      )
    `)
    .eq('followingId', userId)
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return (data || []).map((f) => ({
    ...normalizeProfile(f.follower),
    followedAt: f.createdAt,
  }));
}

/**
 * Get users that a user is following.
 */
export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('Follow')
    .select(`
      id, createdAt,
      following:User!followingId(
        id, displayName, dateOfBirth, isVerified, city, gender,
        photos:Photo(*),
        profile:Profile(*)
      )
    `)
    .eq('followerId', userId)
    .order('createdAt', { ascending: false });

  if (error) throw error;
  return (data || []).map((f) => ({
    ...normalizeProfile(f.following),
    followedAt: f.createdAt,
  }));
}

/**
 * Get follower and following counts for a user.
 */
export async function getFollowCounts(userId) {
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase.from('Follow').select('*', { count: 'exact', head: true }).eq('followingId', userId),
    supabase.from('Follow').select('*', { count: 'exact', head: true }).eq('followerId', userId),
  ]);

  return {
    followers: followerCount || 0,
    following: followingCount || 0,
  };
}

/**
 * Get mutual follows (friends) for a user.
 */
export async function getFriends(userId) {
  // Get people I follow
  const { data: myFollowing } = await supabase
    .from('Follow')
    .select('followingId')
    .eq('followerId', userId);

  if (!myFollowing?.length) return [];

  const followingIds = myFollowing.map((f) => f.followingId);

  // Of those, who follows me back?
  const { data: mutuals } = await supabase
    .from('Follow')
    .select(`
      followerId,
      follower:User!followerId(
        id, displayName, dateOfBirth, isVerified, city, gender,
        photos:Photo(*),
        profile:Profile(*)
      )
    `)
    .eq('followingId', userId)
    .in('followerId', followingIds);

  return (mutuals || []).map((f) => normalizeProfile(f.follower));
}
