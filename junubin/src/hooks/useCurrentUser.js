import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';
import { currentUser as mockCurrentUser } from '../data/mockProfiles';

const MODE_KEY = '@junubin_mode';

// Resolve the user's preferred app mode (Dating vs Social).
//
// Source-of-truth order:
//   1. Profile.appMode — explicit, cross-device, user-set in Settings.
//   2. Profile.accountPurpose — set during ProfileSetup, also cross-device.
//   3. AsyncStorage @junubin_mode — local fallback for legacy installs.
//   4. 'Social' as a safe default.
//
// `appMode` is a small addition (00016 migration) that lets a user
// flip between modes without rewriting their stated purpose. Without
// it, a "dating" account that wanted to browse Social today would have
// to overwrite their purpose. Now they just toggle and `accountPurpose`
// remains the answer to "what brought you here".
const resolveMode = (user, storedMode) => {
  const appMode = user?.profile?.appMode;
  if (appMode === 'social') return 'Social';
  if (appMode === 'dating') return 'Dating';
  const purpose = user?.profile?.accountPurpose;
  if (purpose === 'socialize' || purpose === 'social') return 'Social';
  if (purpose === 'dating' || purpose === 'date') return 'Dating';
  if (storedMode === 'Social' || storedMode === 'Dating') return storedMode;
  return 'Social';
};

/**
 * Core hook replacing all direct `currentUser` imports.
 * Returns a normalized profile matching the shape screens expect.
 * Falls back to mock data when unauthenticated or after API failure in __DEV__.
 */
export function useCurrentUser() {
  const { user, session, refreshUser: authRefresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storedMode, setStoredMode] = useState(null);

  // Read the persisted mode once on mount so HomeScreen reflects what
  // the user chose during ProfileSetup.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(MODE_KEY).then((value) => {
      if (!cancelled) setStoredMode(value);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

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
        mode: resolveMode(user, storedMode),
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
  }, [user, session, storedMode]);

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
