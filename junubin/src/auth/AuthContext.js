import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';
import { identifyUser, resetIdentity } from '../utils/analytics';
import { getProfileRecord } from '../utils/eligibility';
import { devAuthBypassEnabled, DEV_SESSION_KEY, makeDevSession } from '../config/devAuth';
import { visiblePhotos } from '../utils/visiblePhotos';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  // In-flight User fetch. Concurrent callers share this promise rather
  // than getting a bail-out `null` — the old boolean guard made
  // loginWithOtp's own fetch return null whenever onAuthStateChange
  // had already started one, so callers saw "no user" for a user that
  // was actively being loaded.
  const fetchPromiseRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryDelayRef = useRef(1000);

  // The boot User fetch is load-bearing: AppNavigator blocks on
  // `user` for authenticated sessions, so a single failed fetch used
  // to strand the user on the boot spinner until app restart. Retry
  // with capped exponential backoff until it lands (or sign-out).
  const scheduleUserRetry = useCallback((authId) => {
    if (retryTimerRef.current) return;
    const delay = retryDelayRef.current;
    retryDelayRef.current = Math.min(delay * 2, 15000);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      fetchUser(authId).then((u) => {
        if (u) retryDelayRef.current = 1000;
        else scheduleUserRetry(authId);
      }).catch(() => scheduleUserRetry(authId));
    }, delay);
  }, []);

  const clearUserRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    retryDelayRef.current = 1000;
  }, []);

  useEffect(() => {
    // Get initial session. We mark ready as soon as the session resolves so
    // the navigator can mount and the splash can dismiss. The user record
    // fetch (Supabase round-trip) runs in the background and updates state
    // when it lands — keeping cold start fast even on slow networks.
    // Dev bypass: a locally-minted session lives in AsyncStorage, not
    // in Supabase, so rehydrate it before marking ready — otherwise a
    // Metro reload flashes Onboarding on every save. Resolves to true
    // when a dev session was restored, so the Supabase branch below
    // knows not to stomp it with its own null.
    const restoreDevSession = async () => {
      if (!devAuthBypassEnabled()) return false;
      try {
        const raw = await AsyncStorage.getItem(DEV_SESSION_KEY);
        if (!raw) return false;
        const stored = JSON.parse(raw);
        setSession(stored.session);
        setUser(stored.user);
        return true;
      } catch {
        return false;
      }
    };

    restoreDevSession().then((restored) =>
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (!s && restored) { setReady(true); return; }
        setSession(s);
        setReady(true);
        if (s) {
          fetchUser(s.user.id)
            .then((u) => { if (!u) scheduleUserRetry(s.user.id); })
            .catch(() => scheduleUserRetry(s.user.id));
        }
      })
    ).catch(() => {
      setReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      // Supabase fires INITIAL_SESSION/SIGNED_OUT with a null session,
      // which would wipe a dev-bypass session it doesn't know about.
      // Real sign-out still clears state — logout() does it directly.
      if (!s && devAuthBypassEnabled()) return;
      setSession(s);
      if (s) {
        fetchUser(s.user.id)
          .then((u) => { if (!u) scheduleUserRetry(s.user.id); })
          .catch(() => scheduleUserRetry(s.user.id));
      } else {
        clearUserRetry();
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearUserRetry();
    };
  }, []);

  const ensureSupabaseConfig = useCallback(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase config missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    }
    if (!supabaseUrl.startsWith('https://')) {
      throw new Error('Supabase URL must use https:// (ATS blocks insecure http on iOS).');
    }
  }, []);

  const fetchUser = useCallback(async (authId) => {
    // Share the in-flight fetch: a second caller (e.g. loginWithOtp
    // racing onAuthStateChange) awaits the same promise and gets the
    // real user, instead of a bail-out null.
    if (fetchPromiseRef.current) return fetchPromiseRef.current;
    const run = (async () => {
      const { data, error } = await supabase
        .from('User')
        .select('*, profile:Profile(*), photos:Photo(*)')
        .eq('auth_id', authId)
        .single();

      if (!error && data) {
        const normalizedUser = {
          ...data,
          profile: getProfileRecord(data),
          photos: visiblePhotos(data.photos),
        };
        // Banned-on-load: forcibly sign the user out before returning.
        // This catches the "banned while logged in" case the next time
        // their session resumes — they don't see the app, they see the
        // sign-in screen and a one-time alert.
        if (normalizedUser.moderationStatus === 'banned') {
          try { await supabase.auth.signOut(); } catch {}
          setUser(null);
          // Defer the alert so it surfaces *after* the navigator has
          // mounted the auth stack, otherwise it can fire under a
          // splash/loading state and get dismissed silently.
          setTimeout(() => {
            try {
              const { Alert } = require('react-native');
              Alert.alert(
                'Account closed',
                "We've closed this account. Contact support if you think this is a mistake.",
              );
            } catch {}
          }, 600);
          return null;
        }
        setUser(normalizedUser);
        // Identify to PostHog + Sentry the moment we have a User row.
        // Community mode and verification are included as traits so
        // cohort splits stay queryable without exposing profile PII.
        identifyUser(normalizedUser.id, {
          mode: 'community',
          verified: !!normalizedUser.isVerified,
        });
        return normalizedUser;
      }
      return null;
    })();
    fetchPromiseRef.current = run;
    try {
      return await run;
    } finally {
      fetchPromiseRef.current = null;
    }
  }, []);

  const startOtp = useCallback(async ({ email, phone }) => {
    // Dev bypass: no SMS provider is wired up yet, so pretend the code
    // went out and let the OTP step accept anything (see loginWithOtp).
    if (devAuthBypassEnabled()) {
      console.log('[devAuth] OTP send bypassed — enter any 6 digits.');
      return { message: 'OTP sent (dev bypass — enter any 6 digits)' };
    }
    ensureSupabaseConfig();
    if (email) {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      return { message: 'OTP sent' };
    }
    if (phone) {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      return { message: 'OTP sent' };
    }
    throw new Error('Email or phone required');
  }, [ensureSupabaseConfig]);

  const loginWithOtp = useCallback(async ({ email, phone, code }) => {
    // Dev bypass: accept any code, mint a local session + profile-less
    // user so the navigator flips to the authenticated stack and the
    // caller routes on to ProfileSetup.
    if (devAuthBypassEnabled()) {
      const { session: devSession, user: devUser } = makeDevSession(phone || email);
      try {
        await AsyncStorage.setItem(
          DEV_SESSION_KEY,
          JSON.stringify({ session: devSession, user: devUser }),
        );
      } catch {
        // Non-fatal: the session still works this run, it just won't
        // survive a reload.
      }
      setSession(devSession);
      setUser(devUser);
      console.log('[devAuth] OTP check bypassed — signed in as', devUser.id);
      return { session: devSession, user: devSession.user, appUser: devUser };
    }

    ensureSupabaseConfig();
    let result;
    if (email) {
      result = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    } else if (phone) {
      result = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    } else {
      throw new Error('Email or phone required');
    }

    if (result.error) throw result.error;

    // Session is set automatically via onAuthStateChange
    // Fetch user data and return it so callers know if profile exists
    let appUser = null;
    if (result.data.user) {
      appUser = await fetchUser(result.data.user.id);
    }

    return { ...result.data, appUser };
  }, [fetchUser, ensureSupabaseConfig]);

  const logout = useCallback(async () => {
    // Under the dev bypass there's no Supabase session to end, and a
    // throw here would skip the state/storage clear below.
    if (devAuthBypassEnabled()) {
      try { await supabase.auth.signOut(); } catch {}
    } else {
      await supabase.auth.signOut();
    }
    // Drop the analytics identity so subsequent events aren't
    // mistakenly attributed to the previous user.
    resetIdentity();
    setUser(null);
    setSession(null);
    // Clear local user-state so the next sign-in / sign-up runs the full
    // first-time experience again. Includes onboarding flag, mode/purpose
    // selections, seen-connection set, etc. — anything keyed to a "this
    // device has already seen X" assumption. The legacy-key migration
    // sentinel stays so we don't replay it. Storage flagged @junubin_*
    // is enumerated dynamically so future keys are covered too.
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keepers = new Set(['@junubin_keys_migrated_v1']);
      const clearable = allKeys.filter((k) =>
        k.startsWith('@junubin_') && !keepers.has(k)
      );
      if (clearable.length) {
        await AsyncStorage.multiRemove(clearable);
      }
    } catch {
      // Best-effort. If storage clear fails, the user will land on the
      // app shell rather than Onboarding, which is recoverable by tapping
      // "Sign Out" again. Not blocking.
    }
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  // refreshUser captures the session via a ref so the function
  // identity stays stable across re-renders and consumers can put it
  // in dependency arrays without retriggering effects on every auth
  // state change. The ref always points at the latest session, so
  // there's no risk of fetching the old user id after a re-auth.
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const refreshUser = useCallback(async () => {
    const s = sessionRef.current;
    if (s?.user?.id) {
      await fetchUser(s.user.id);
    }
  }, [fetchUser]);

  const value = useMemo(
    () => ({
      user,
      session,
      ready,
      isAuthenticated: !!session,
      startOtp,
      loginWithOtp,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, session, ready, startOtp, loginWithOtp, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
