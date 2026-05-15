import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';
import { currentUser as demoCurrentUser } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';

const MODE_KEY = '@junubin_mode';

// Neutral defaults for a brand-new account. Previously these came
// from the deleted `mockCurrentUser` fixture; now they live here so
// the hook has zero dependency on demo data.
const DEFAULT_LOOKING_FOR = 'Everyone';
const DEFAULT_AGE_RANGE   = [18, 99];
const DEFAULT_DISTANCE_MI = 50; // ~80km
const DEFAULT_AVATAR      = null;

// Empty placeholder returned to consumers when no User row exists yet
// (unauthenticated screens, the brief window between sign-in and the
// User fetch landing). Shape matches what consumer screens dereference
// so optional-chaining isn't required everywhere.
const EMPTY_CURRENT_USER = Object.freeze({
  id: null,
  name: '',
  email: '',
  avatar: DEFAULT_AVATAR,
  images: [],
  bio: '',
  preferences: Object.freeze({
    mode: 'Social',
    showMe: true,
    lookingFor: DEFAULT_LOOKING_FOR,
    ageRange: DEFAULT_AGE_RANGE,
    distance: DEFAULT_DISTANCE_MI,
  }),
  boosts: 0,
  superLikes: 0,
  notes: 0,
});

// Resolve the user's preferred app mode (Dating vs Social).
//
// Source-of-truth order:
//   1. Profile.appMode — explicit, cross-device, user-set in Settings.
//   2. Profile.accountPurpose — set during ProfileSetup, also cross-device.
//   3. AsyncStorage @junubin_mode — local fallback for legacy installs.
//   4. 'Social' as a safe default.
const resolveMode = (user, storedMode) => {
  const appMode = user?.profile?.appMode;
  if (appMode === 'social') return 'Social';
  if (appMode === 'dating') return 'Dating';
  const purpose = user?.profile?.accountPurpose;
  if (purpose === 'socialize' || purpose === 'social') return 'Social';
  if (purpose === 'dating' || purpose === 'date') return 'Dating';
  if (purpose === 'both') {
    return storedMode === 'Dating' || storedMode === 'Social' ? storedMode : 'Social';
  }
  if (storedMode === 'Social' || storedMode === 'Dating') return storedMode;
  return 'Social';
};

/**
 * Core hook replacing all direct `currentUser` imports.
 * Returns a normalized profile matching the shape screens expect.
 * Returns the empty placeholder when unauthenticated — no mock user.
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
      const p = user.profile || {};
      normalized.preferences = {
        mode: resolveMode(user, storedMode),
        showMe: p.showMe ?? true,
        lookingFor: p.lookingForGender || DEFAULT_LOOKING_FOR,
        ageRange: [
          p.minPreferredAge ?? DEFAULT_AGE_RANGE[0],
          p.maxPreferredAge ?? DEFAULT_AGE_RANGE[1],
        ],
        distance: p.maxDistanceKm
          ? Math.round(p.maxDistanceKm / 1.6)
          : DEFAULT_DISTANCE_MI,
      };
      normalized.avatar = normalized.images?.[0] || DEFAULT_AVATAR;
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

  // When unauthenticated and demo mode is on, return the demo
  // current-user fixture so screens have a non-null `currentUser`
  // shape and can render avatars / preferences. With demo off, fall
  // back to the frozen empty placeholder.
  const currentUser = useMemo(
    () => profile || (DEMO_DATA_ENABLED ? demoCurrentUser : EMPTY_CURRENT_USER),
    [profile],
  );
  const isAuthenticated = !!session;

  return { currentUser, refreshUser, isAuthenticated, loading };
}
