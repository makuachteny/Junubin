import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';
import PaymentService from '../payments/PaymentService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    // Get initial session. We mark ready as soon as the session resolves so
    // the navigator can mount and the splash can dismiss. The user record
    // fetch (Supabase round-trip) runs in the background and updates state
    // when it lands — keeping cold start fast even on slow networks.
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setReady(true);
      if (s) {
        PaymentService.identify(s.user.id);
        fetchUser(s.user.id).catch(() => {});
      }
    }).catch(() => {
      setReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        PaymentService.identify(s.user.id);
        fetchUser(s.user.id);
      } else {
        PaymentService.logout();
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
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
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('User')
        .select('*, profile:Profile(*), photos:Photo(*)')
        .eq('auth_id', authId)
        .single();

      if (!error && data) {
        // Banned-on-load: forcibly sign the user out before returning.
        // This catches the "banned while logged in" case the next time
        // their session resumes — they don't see the app, they see the
        // sign-in screen and a one-time alert.
        if (data.moderationStatus === 'banned') {
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
        setUser(data);
        return data;
      }
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const startOtp = useCallback(async ({ email, phone }) => {
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
    await supabase.auth.signOut();
    PaymentService.logout();
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
