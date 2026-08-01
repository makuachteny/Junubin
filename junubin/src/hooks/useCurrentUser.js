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
    mode: 'Community',
  }),
});

// The product has one active community mode. Old stored mode values are
// ignored once loaded; keeping the read path lets older installs migrate
// without changing downstream currentUser shape.
const resolveMode = () => 'Community';

/**
 * Core hook replacing all direct `currentUser` imports.
 * Returns a normalized profile matching the shape screens expect.
 * Returns the empty placeholder when unauthenticated — no mock user.
 */
export function useCurrentUser() {
  const { user, session, refreshUser: authRefresh } = useAuth();
  const [storedMode, setStoredMode] = useState(null);

  // Read the old persisted mode key once so older installs keep the same
  // currentUser shape while normalizing to Community.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(MODE_KEY).then((value) => {
      if (!cancelled) setStoredMode(value);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Derive the normalized profile SYNCHRONOUSLY from the auth user.
  //
  // This used to live in a useState + useEffect, which left `profile`
  // null for the first render — so `currentUser` fell back to the demo
  // / empty placeholder on mount. Screens that seed local state from
  // currentUser at mount (EditProfile's form, sticker + currentlyInto
  // state) captured that placeholder and never re-hydrated, so the
  // editor opened showing demo data with every chip unselected even
  // though the user had filled everything in during the survey.
  // Computing with useMemo means currentUser is the real profile on the
  // very first render whenever `user` is already in the auth context —
  // which it is by the time any post-sign-in screen mounts.
  const profile = useMemo(() => {
    if (!session || !user) return null;
    const normalized = profileService.normalizeProfile(user);
    if (normalized) {
      normalized.preferences = {
        mode: resolveMode(user, storedMode),
      };
      normalized.avatar = normalized.images?.[0] || DEFAULT_AVATAR;
    }
    return normalized;
  }, [user, session, storedMode]);

  // Authenticated but the User row hasn't landed yet.
  const loading = !!session && !user;

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
