import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../api/client';

const ACCESS_KEY = '@junubin_access_token';
const REFRESH_KEY = '@junubin_refresh_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const refreshingRef = useRef(null);
  // Keep a ref to latest tokens for use inside callbacks without re-creating them
  const tokensRef = useRef({ accessToken: null, refreshToken: null });
  tokensRef.current = { accessToken, refreshToken };

  useEffect(() => {
    (async () => {
      const [storedAccess, storedRefresh] = await Promise.all([
        AsyncStorage.getItem(ACCESS_KEY),
        AsyncStorage.getItem(REFRESH_KEY),
      ]);
      setAccessToken(storedAccess);
      setRefreshToken(storedRefresh);
      if (storedAccess) {
        try {
          const me = await apiRequest('/auth/me', { token: storedAccess });
          setUser(me.user);
        } catch (err) {
          if (err.status === 401 && storedRefresh) {
            try {
              const tokens = await apiRequest('/auth/refresh', {
                method: 'POST',
                body: { refreshToken: storedRefresh },
              });
              setAccessToken(tokens.accessToken);
              setRefreshToken(tokens.refreshToken);
              await AsyncStorage.multiSet([
                [ACCESS_KEY, tokens.accessToken],
                [REFRESH_KEY, tokens.refreshToken],
              ]);
              const me = await apiRequest('/auth/me', { token: tokens.accessToken });
              setUser(me.user);
            } catch {
              await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
              setAccessToken(null);
              setRefreshToken(null);
            }
          } else {
            await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
            setAccessToken(null);
            setRefreshToken(null);
          }
        }
      }
      setReady(true);
    })();
  }, []);

  const startOtp = useCallback(async ({ email, phone }) => {
    return apiRequest('/auth/otp/start', {
      method: 'POST',
      body: { email, phone },
    });
  }, []);

  const loginWithOtp = useCallback(async ({ email, phone, code }) => {
    const data = await apiRequest('/auth/otp/verify', {
      method: 'POST',
      body: { email, phone, code },
    });
    setUser(data.user);
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    await AsyncStorage.multiSet([
      [ACCESS_KEY, data.accessToken],
      [REFRESH_KEY, data.refreshToken],
    ]);
    return data.user;
  }, []);

  const clearAuth = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  }, []);

  const logout = useCallback(async () => {
    try {
      const rt = tokensRef.current.refreshToken;
      if (rt) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken: rt },
        });
      }
    } catch { /* ignore logout errors */ }
    await clearAuth();
  }, [clearAuth]);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  const authenticatedRequest = useCallback(async (path, options = {}) => {
    const { accessToken: at, refreshToken: rt } = tokensRef.current;
    try {
      return await apiRequest(path, { ...options, token: at });
    } catch (err) {
      if (err.status === 401 && rt) {
        if (!refreshingRef.current) {
          refreshingRef.current = apiRequest('/auth/refresh', {
            method: 'POST',
            body: { refreshToken: rt },
          }).finally(() => { refreshingRef.current = null; });
        }
        try {
          const tokens = await refreshingRef.current;
          setAccessToken(tokens.accessToken);
          setRefreshToken(tokens.refreshToken);
          await AsyncStorage.multiSet([
            [ACCESS_KEY, tokens.accessToken],
            [REFRESH_KEY, tokens.refreshToken],
          ]);
          return await apiRequest(path, { ...options, token: tokens.accessToken });
        } catch {
          await clearAuth();
          throw err;
        }
      }
      throw err;
    }
  }, [clearAuth]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      refreshToken,
      ready,
      isAuthenticated: !!accessToken,
      startOtp,
      loginWithOtp,
      logout,
      updateUser,
      authenticatedRequest,
    }),
    [user, accessToken, refreshToken, ready, startOtp, loginWithOtp, logout, updateUser, authenticatedRequest]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
