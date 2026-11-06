// AnaJunubin — useFollow Hook
// Manages follow state for a target user with optimistic updates
import { useState, useCallback, useEffect, useRef } from 'react';
import * as followService from '../api/services/followService';
import { useAuth, useRequireAuth } from '../auth';
import { reportError } from '../utils/reportError';

/**
 * Hook to manage follow relationship with a specific user.
 * Provides optimistic UI updates with rollback on failure.
 *
 * @param {string} targetUserId - The user ID to follow/unfollow
 * @param {boolean} initialFollowing - Optional initial follow state (avoids extra fetch)
 */
export function useFollow(targetUserId, initialFollowing = null) {
  const { session } = useAuth();
  const requireAuth = useRequireAuth();
  const [isFollowing, setIsFollowing] = useState(initialFollowing ?? false);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch initial follow state if not provided
  useEffect(() => {
    if (!session || !targetUserId || initialFollowing !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const following = await followService.isFollowing(targetUserId);
        if (!cancelled && mountedRef.current) setIsFollowing(following);
      } catch (err) {
        reportError('useFollow.isFollowing', err, { targetUserId });
      }
    })();
    return () => { cancelled = true; };
  }, [session, targetUserId, initialFollowing]);

  // Fetch follow counts
  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await followService.getFollowCounts(targetUserId);
        if (!cancelled && mountedRef.current) setCounts(c);
      } catch (err) {
        reportError('useFollow.getFollowCounts', err, { targetUserId });
      }
    })();
    return () => { cancelled = true; };
  }, [targetUserId]);

  // Check friendship (mutual follow)
  useEffect(() => {
    if (!session || !targetUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const friends = await followService.areFriends(targetUserId);
        if (!cancelled && mountedRef.current) setIsFriend(friends);
      } catch (err) {
        reportError('useFollow.areFriends', err, { targetUserId });
      }
    })();
    return () => { cancelled = true; };
  }, [session, targetUserId, isFollowing]);

  const toggleFollow = useCallback(async () => {
    if (loading || !targetUserId) return;
    if (!requireAuth('Sign in to follow people on JuNubin.')) return;
    const wasFollowing = isFollowing;
    setLoading(true);

    // Optimistic update
    setIsFollowing(!wasFollowing);
    setCounts((prev) => ({
      ...prev,
      followers: wasFollowing
        ? Math.max(prev.followers - 1, 0)
        : prev.followers + 1,
    }));

    try {
      if (wasFollowing) {
        await followService.unfollowUser(targetUserId);
      } else {
        await followService.followUser(targetUserId);
      }
    } catch (err) {
      reportError('useFollow.toggle', err, { targetUserId, wasFollowing });
      // Rollback on failure
      if (mountedRef.current) {
        setIsFollowing(wasFollowing);
        setCounts((prev) => ({
          ...prev,
          followers: wasFollowing
            ? prev.followers + 1
            : Math.max(prev.followers - 1, 0),
        }));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isFollowing, loading, targetUserId, requireAuth]);

  return {
    isFollowing,
    isFriend,
    loading,
    counts,
    toggleFollow,
  };
}

/**
 * Hook to get follow counts for the current user's profile.
 */
export function useMyFollowCounts(userId) {
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await followService.getFollowCounts(userId);
        if (!cancelled) setCounts(c);
      } catch (err) {
        reportError('useMyFollowCounts', err, { userId });
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return counts;
}
