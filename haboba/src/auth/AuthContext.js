import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [devBypass, setDevBypass] = useState(false);
  const fetchingRef = useRef(false);
  const DEV_BYPASS_ENABLED = process.env.EXPO_PUBLIC_DEV_BYPASS_AUTH === 'true';

  useEffect(() => {
    if (DEV_BYPASS_ENABLED) {
      AsyncStorage.getItem('@dev_bypass_auth').then((val) => {
        if (val === 'true') setDevBypass(true);
      }).catch(() => {});
    }
    // Get initial session — await user fetch so navigator has full data
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s) {
        await fetchUser(s.user.id);
      }
      setReady(true);
    }).catch(() => {
      setReady(true);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        fetchUser(s.user.id);
      } else {
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
    setUser(null);
    setSession(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  const refreshUser = useCallback(async () => {
    if (session?.user?.id) {
      await fetchUser(session.user.id);
    }
  }, [session, fetchUser]);

  const value = useMemo(
    () => ({
      user,
      session,
      ready,
      isAuthenticated: !!session || devBypass,
      devBypass,
      setDevBypass: async (next) => {
        setDevBypass(!!next);
        if (DEV_BYPASS_ENABLED) {
          try {
            await AsyncStorage.setItem('@dev_bypass_auth', next ? 'true' : 'false');
          } catch {
            // ignore persistence errors
          }
        }
      },
      startOtp,
      loginWithOtp,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, session, ready, devBypass, startOtp, loginWithOtp, logout, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
