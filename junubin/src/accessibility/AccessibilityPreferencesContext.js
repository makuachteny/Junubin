import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@junubin_accessibility_prefs_v1';

export const defaultAccessibilityPrefs = {
  surveyCompleted: false,
  highContrast: false,
  nonColorCues: false,
  largerTouchTargets: false,
  reducedMotion: false,
  screenReaderHints: true,
};

const AccessibilityPreferencesContext = createContext({
  ready: true,
  prefs: defaultAccessibilityPrefs,
  saveSurveyResponses: async () => {},
  updatePrefs: async () => {},
  resetPrefs: async () => {},
});

export function AccessibilityPreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(defaultAccessibilityPrefs);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setPrefs((prev) => ({ ...prev, ...(parsed || {}) }));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback(async (next) => {
    setPrefs(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const saveSurveyResponses = useCallback(async (responses) => {
    const next = {
      ...defaultAccessibilityPrefs,
      ...(responses || {}),
      surveyCompleted: true,
    };
    await persist(next);
  }, [persist]);

  const updatePrefs = useCallback(async (patch) => {
    const next = { ...prefs, ...(patch || {}) };
    await persist(next);
  }, [prefs, persist]);

  const resetPrefs = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setPrefs(defaultAccessibilityPrefs);
  }, []);

  const value = useMemo(
    () => ({ ready, prefs, saveSurveyResponses, updatePrefs, resetPrefs }),
    [ready, prefs, saveSurveyResponses, updatePrefs, resetPrefs],
  );

  if (!ready) return null;

  return (
    <AccessibilityPreferencesContext.Provider value={value}>
      {children}
    </AccessibilityPreferencesContext.Provider>
  );
}

export function useAccessibilityPreferences() {
  return useContext(AccessibilityPreferencesContext);
}
