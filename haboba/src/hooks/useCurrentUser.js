import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';
import { currentUser as mockCurrentUser } from '../data/mockProfiles';

/**
 * Core hook replacing all direct `currentUser` imports.
 * Returns a normalized profile matching the shape screens expect.
 * Falls back to mock data when unauthenticated or after API failure in __DEV__.
 */
export function useCurrentUser() {
  const { user, session, refreshUser: authRefresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const normalized = profileService.normalizeProfile(user);
    if (normalized) {
      // Synthesize preferences from Profile table columns
      const p = user.profile || {};
      normalized.preferences = {
        mode: 'Dating',
        showMe: p.showMe ?? true,
        lookingFor: p.lookingForGender || mockCurrentUser.preferences.lookingFor,
        ageRange: [
          p.minPreferredAge ?? mockCurrentUser.preferences.ageRange[0],
          p.maxPreferredAge ?? mockCurrentUser.preferences.ageRange[1],
        ],
        distance: p.maxDistanceKm
          ? Math.round(p.maxDistanceKm / 1.6)
          : mockCurrentUser.preferences.distance,
      };
      normalized.avatar = normalized.images?.[0] || mockCurrentUser.avatar;
      normalized.boosts = 0;
      normalized.superLikes = 0;
      normalized.notes = 0;
    }
    setProfile(normalized);
    setLoading(false);
  }, [user, session]);

  const refreshUser = useCallback(async () => {
    try {
      await authRefresh();
    } catch {
      // Silently fail — profile stays at last known state
    }
  }, [authRefresh]);

  const currentUser = useMemo(() => {
    if (profile) return profile;
    // Fall back to mock when not authenticated or in dev after API failure
    return mockCurrentUser;
  }, [profile]);

  const isAuthenticated = !!session;

  return { currentUser, refreshUser, isAuthenticated, loading };
}
