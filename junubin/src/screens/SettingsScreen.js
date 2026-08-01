import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import BrandLogo from '../components/BrandLogo';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import * as safetyService from '../api/services/safetyService';
import { supabase } from '../config/supabase';
import {
  promptForPushPermission,
  getNotificationPermissionStatus,
} from '../utils/notifications';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { LOCATION_VISIBILITY, LOCATION_VISIBILITY_OPTIONS } from '../utils/locationConsent';
import { REFERRALS_BACKEND_READY } from '../utils/referralService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INCOGNITO_KEY = '@junubin_incognito';
const DISTANCE_UNIT_KEY = '@junubin_distance_unit';

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, session } = useAuth();
  const { currentUser } = useCurrentUser();
  const [showMe, setShowMe] = useState(currentUser.preferences?.showMe ?? true);

  const handleShowMeToggle = (val) => {
    setShowMe(val);
    if (session) {
      profileService.updateProfile({ showMe: val }).catch(() => {});
    }
  };
  // Payments UI is permanently off — the only thing we still need from
  // the subscription context is `reset()` so logout/delete clear any
  // cached entitlement state.
  const { reset } = useSubscription();
  const [incognito, setIncognitoState] = useState(false);
  const [distanceUnit, setDistanceUnitState] = useState('mi');
  // Location visibility. Source of truth is `Profile.locationVisibility`
  // (00047) — 'off' | 'city' | 'coarse', defaulting to 'off'. The legacy
  // `Profile.shareLocation` boolean is kept in sync by a DB trigger, so
  // we only ever write the new column from here.
  const [locationVisibility, setLocationVisibilityState] = useState(LOCATION_VISIBILITY.OFF);
  // Temporary sharing window (`Profile.locationVisibleUntil`, 00047).
  // null = visible until manually disabled; a future ISO timestamp
  // means "visible until then", after which discover-nearby hides the
  // user server-side with no cron needed.
  const [visibleUntil, setVisibleUntilState] = useState(null);

  // Hydrate persisted toggles on mount. Incognito's source of truth is
  // `Profile.incognito` (so it syncs across devices); AsyncStorage is a
  // fast-path cache that avoids a flicker on cold start before the
  // server fetch lands. distanceUnit stays local-only — it's a UI
  // display preference, not an account setting.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(INCOGNITO_KEY),
      AsyncStorage.getItem(DISTANCE_UNIT_KEY),
    ]).then(([inc, unit]) => {
      if (cancelled) return;
      if (inc === 'true') setIncognitoState(true);
      if (unit === 'mi' || unit === 'km') setDistanceUnitState(unit);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Re-hydrate incognito from currentUser whenever the profile changes
  // (e.g., after refreshUser fires from useAppStateRefresh on
  // background→foreground). Server wins; AsyncStorage is updated to
  // match so the next cold start matches the server immediately.
  useEffect(() => {
    const serverFlag = !!currentUser?.profile?.incognito;
    setIncognitoState(serverFlag);
    AsyncStorage.setItem(INCOGNITO_KEY, serverFlag ? 'true' : 'false').catch(() => {});
  }, [currentUser?.profile?.incognito]);

  // Location visibility is server-only (no AsyncStorage cache) — the
  // map surface is only meaningful when authenticated, so the brief
  // flash of 'off' before the server fetch lands is acceptable, and
  // erring toward hidden is the right way to be wrong. Falls back to
  // the legacy boolean for a client running against a pre-00047 DB.
  useEffect(() => {
    const profile = currentUser?.profile;
    const stored = profile?.locationVisibility;

    // An expired temporary window means the server already treats this
    // user as hidden. Reconcile the stored state to match ("visible for
    // 1 hour" ending IS turning visibility off) so the radio group
    // doesn't claim a visibility level nobody can see. Fire-and-forget:
    // the server ignores expired windows either way.
    const until = profile?.locationVisibleUntil || null;
    const expired = until && new Date(until).getTime() <= Date.now();
    if (expired && stored !== LOCATION_VISIBILITY.OFF) {
      setLocationVisibilityState(LOCATION_VISIBILITY.OFF);
      setVisibleUntilState(null);
      profileService.updateProfile({
        locationVisibility: LOCATION_VISIBILITY.OFF,
        locationVisibleUntil: null,
      }).catch(() => {});
      return;
    }
    setVisibleUntilState(expired ? null : until);

    if (stored === LOCATION_VISIBILITY.CITY || stored === LOCATION_VISIBILITY.COARSE) {
      setLocationVisibilityState(stored);
    } else if (stored === LOCATION_VISIBILITY.OFF) {
      setLocationVisibilityState(LOCATION_VISIBILITY.OFF);
    } else {
      setLocationVisibilityState(
        profile?.shareLocation ? LOCATION_VISIBILITY.COARSE : LOCATION_VISIBILITY.OFF,
      );
    }
  }, [currentUser?.profile?.locationVisibility, currentUser?.profile?.shareLocation, currentUser?.profile?.locationVisibleUntil]);

  // Persist on change. Write to the DB first so other devices can see
  // it; the local cache is best-effort. If the DB write fails (offline),
  // we revert the toggle so the user isn't lied to about a setting that
  // didn't actually save.
  const setIncognito = useCallback(async (next) => {
    setIncognitoState(next);
    AsyncStorage.setItem(INCOGNITO_KEY, next ? 'true' : 'false').catch(() => {});
    try {
      await profileService.updateProfile({ incognito: next });
    } catch (e) {
      // Revert local state on failure.
      setIncognitoState(!next);
      AsyncStorage.setItem(INCOGNITO_KEY, !next ? 'true' : 'false').catch(() => {});
      Alert.alert('Could not update', e?.message || 'Try again when you have a connection.');
    }
  }, []);
  const setDistanceUnit = useCallback((next) => {
    const value = typeof next === 'function' ? next(distanceUnit) : next;
    setDistanceUnitState(value);
    AsyncStorage.setItem(DISTANCE_UNIT_KEY, value).catch(() => {});
  }, [distanceUnit]);

  // Same revert-on-failure pattern as Incognito. Writing this column is
  // what makes someone discoverable, so a failed save must not leave the
  // UI claiming a visibility level the server never accepted.
  const setLocationVisibility = useCallback(async (next) => {
    const previous = locationVisibility;
    if (next === previous) return;
    setLocationVisibilityState(next);
    // Changing level always resets the temporary window: turning off
    // clears it by definition, and turning on starts from "until I
    // turn it off" so a stale window from a previous session can't
    // silently hide someone who believes they just became visible.
    const previousUntil = visibleUntil;
    setVisibleUntilState(null);
    try {
      await profileService.updateProfile({ locationVisibility: next, locationVisibleUntil: null });
    } catch (e) {
      setLocationVisibilityState(previous);
      setVisibleUntilState(previousUntil);
      Alert.alert('Could not update', e?.message || 'Try again when you have a connection.');
    }
  }, [locationVisibility, visibleUntil]);

  // Temporary-visibility window. `hours` = 1 | 8 | null (no limit).
  // Same revert-on-failure pattern — a window the server never accepted
  // must not be shown as active.
  const setTemporaryWindow = useCallback(async (hours) => {
    const previous = visibleUntil;
    const next = hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null;
    setVisibleUntilState(next);
    try {
      await profileService.updateProfile({ locationVisibleUntil: next });
    } catch (e) {
      setVisibleUntilState(previous);
      Alert.alert('Could not update', e?.message || 'Try again when you have a connection.');
    }
  }, [visibleUntil]);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 340,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  const handleViewBlocked = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        Alert.alert('Blocked Users', 'Sign in to manage blocked users.');
        return;
      }
      const { data: appUser } = await supabase
        .from('User')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();
      if (!appUser) {
        Alert.alert('Blocked Users', 'Could not load your account.');
        return;
      }

      const { data: rows, error } = await supabase
        .from('Block')
        .select('blockedId, blocked:User!blockedId(id, displayName)')
        .eq('blockerId', appUser.id);
      if (error) throw error;

      if (!rows || rows.length === 0) {
        Alert.alert('Blocked Users', 'You have no blocked users.', [{ text: 'OK' }]);
        return;
      }

      const buttons = rows.slice(0, 8).map((r) => ({
        text: `Unblock ${r.blocked?.displayName || 'user'}`,
        onPress: async () => {
          try {
            await safetyService.unblockUser(r.blockedId);
            Alert.alert('Unblocked', 'They can now see and contact you again.');
          } catch (e) {
            Alert.alert('Could not unblock', e?.message || 'Try again.');
          }
        },
      }));
      buttons.push({ text: 'Done', style: 'cancel' });
      Alert.alert(
        'Blocked Users',
        rows.length > 8 ? `Showing first 8 of ${rows.length}.` : `${rows.length} blocked.`,
        buttons,
      );
    } catch (e) {
      Alert.alert('Blocked Users', e?.message || 'Could not load blocked list.');
    }
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            await reset();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            // Hard delete via the account-delete Edge Function:
            // tears down storage objects, the User row (FK
            // cascades the rest), and the auth.users row. App
            // Store guideline 5.1.1.v requires "real" deletion;
            // soft-deletes leave the account discoverable and
            // matchable, which violates that guideline.
            let serverDeleted = false;
            try {
              if (session?.access_token) {
                const { error } = await supabase.functions.invoke('account-delete', {
                  method: 'POST',
                });
                if (!error) serverDeleted = true;
              }
            } catch (e) {
              if (__DEV__) console.warn('account-delete failed:', e);
            }
            // If the Edge Function isn't deployed yet (early dev)
            // fall back to the soft-delete flag so the in-app
            // sign-out still happens. The flag isn't filtered on
            // reads anywhere — surfaced here only so the prior
            // behavior is preserved during deploy.
            if (!serverDeleted) {
              try {
                if (session) {
                  await profileService.updateProfile({ deletedAt: new Date().toISOString() });
                }
              } catch {}
            }
            await logout();
            await reset();
          },
        },
      ]
    );
  }, [session, logout, reset]);

  // Push notifications — distinct from the (deferred) in-app
  // notification feed. The OS-level permission powers the real
  // push pipeline (00013 triggers → push-send). Tapping this
  // row either prompts the user the first time, or opens the
  // system Settings if they've already denied.
  const handleNotifications = useCallback(async () => {
    const status = await getNotificationPermissionStatus();
    if (status === 'granted') {
      Alert.alert(
        'Notifications on',
        'You\'ll get a heads-up when someone follows you, sends a message, or asks to connect.',
      );
      return;
    }
    if (status === 'denied') {
      promptToOpenSettings({
        title: 'Notifications turned off',
        message: 'Open Settings to let JuNubin send you push notifications about new followers, messages, and connection requests.',
      });
      return;
    }
    const token = await promptForPushPermission();
    if (token) {
      Alert.alert('Notifications on', 'You\'re all set.');
    } else {
      promptToOpenSettings({
        title: 'Notifications still off',
        message: 'You can enable JuNubin notifications in Settings whenever you change your mind.',
      });
    }
  }, []);

  const handleInfoPagePress = useCallback((pageKey) => {
    navigation.navigate('SettingsInfo', { pageKey });
  }, [navigation]);

  const handleManageAccount = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const isVerified = !!(currentUser?.verified || currentUser?.profile?.isVerified);

  // ACCOUNT & SAFETY — flat rows, mock order. Everything reuses the
  // pre-existing handlers verbatim; only the presentation changed.
  const accountRows = useMemo(() => [
    {
      label: isVerified ? 'Verify your photo — done ✓' : 'Verify your photo',
      onPress: () => navigation.navigate('PhotoVerification'),
    },
    { label: 'Blocked people', onPress: handleViewBlocked },
    { label: 'Notifications', onPress: handleNotifications },
    // The info pages stay individual rows (SettingsInfo renders one
    // pageKey at a time — there is no index page to drill into yet).
    { label: 'FAQ', onPress: () => handleInfoPagePress('faq') },
    { label: 'Contact us', onPress: () => handleInfoPagePress('contact') },
    { label: 'Terms of use', onPress: () => handleInfoPagePress('terms') },
    { label: 'Privacy policy', onPress: () => handleInfoPagePress('privacy') },
    { label: 'Community guidelines', onPress: () => handleInfoPagePress('guidelines') },
    { label: 'Safety tips', onPress: () => handleInfoPagePress('safety') },
    // Accessibility prefs are a one-time onboarding step but the
    // screen is reusable for tuning later — exposing it here gives
    // a user who skipped it (or who developed new needs) a way back
    // in without flipping accountPurpose.
    { label: 'Accessibility preferences', onPress: () => navigation.navigate('AccessibilitySurvey', { returnTo: 'back' }) },
    { label: 'Manage account', onPress: handleManageAccount },
    { label: 'Log out', onPress: handleLogout },
    { label: 'Delete account', destructive: true, onPress: handleDeleteAccount },
  ], [isVerified, handleViewBlocked, handleNotifications, handleInfoPagePress, handleManageAccount, handleDeleteAccount, navigation]);

  const renderRow = (row) => (
    <TouchableOpacity
      key={row.label}
      style={styles.flatRow}
      onPress={row.onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={row.label}
    >
      <Text style={[styles.flatRowLabel, row.destructive && { color: colors.error }]}>
        {row.label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        style={{
          opacity: contentAnim,
          transform: [
            {
              translateY: contentAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}
      >
        {/* ── LOCATION VISIBILITY ── */}
        {/* Three explicit levels rather than a single on/off switch, so
            "I want people to know I'm in Nairobi" and "I want a pin on
            the map" are separate choices. Hidden is the default and
            stays the default. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOCATION VISIBILITY</Text>
          {LOCATION_VISIBILITY_OPTIONS.map((opt) => {
            const selected = locationVisibility === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.visOption, selected && styles.visOptionActive]}
                onPress={() => setLocationVisibility(opt.value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.label}. ${opt.description}`}
                testID={`location-visibility-${opt.value}`}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={styles.visOptionText}>
                  <Text style={styles.visOptionLabel}>{opt.label}</Text>
                  <Text style={styles.visOptionDesc}>{opt.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Temporary visibility — only meaningful when the user is
              visible at all. "1 hour" / "8 hours" write a future
              locationVisibleUntil; discover-nearby drops the user the
              moment it passes, and the hydrate effect above flips the
              radio back to Hidden on the next visit. */}
          {locationVisibility !== LOCATION_VISIBILITY.OFF && (
            <View style={styles.visibleForBlock}>
              <Text style={styles.visibleForLabel}>Stay visible for</Text>
              <View style={styles.visibleForRow}>
                {[
                  { hours: 1, label: '1 hour' },
                  { hours: 8, label: '8 hours' },
                  { hours: null, label: 'Until I turn it off' },
                ].map((opt) => {
                  const selected = opt.hours === null ? !visibleUntil : false;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.visibleForChip, selected && styles.visibleForChipActive]}
                      onPress={() => setTemporaryWindow(opt.hours)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Stay visible for ${opt.label}`}
                      testID={`visible-for-${opt.hours ?? 'unlimited'}`}
                    >
                      <Text style={[styles.visibleForChipText, selected && styles.visibleForChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {visibleUntil && (
                <Text style={styles.visibleForUntil}>
                  Visible until {new Date(visibleUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  {' — after that you go back to Hidden automatically.'}
                </Text>
              )}
            </View>
          )}
          <Text style={styles.footnote}>
            Your location is never sold, shared with advertisers, or used to target ads, and
            JuNubin never tracks you in the background.
          </Text>
        </View>

        {/* ── APPEARANCE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.borderedRow}>
            <Text style={styles.rowLabel}>Dark mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.gray300, true: colors.accent }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Dark mode"
            />
          </View>
        </View>

        {/* ── ACCOUNT & SAFETY ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT & SAFETY</Text>
          {accountRows.map(renderRow)}
        </View>

        {/* ── DISCOVERY ── */}
        {/* Toggles that govern whether/how this user shows up in other
            people's results. Same wiring as before, new clothes. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DISCOVERY</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchRowText}>
              <Text style={styles.rowLabel}>Show me on JuNubin</Text>
              <Text style={styles.rowDesc}>
                While turned off, you will not appear in the directory or on the map.
              </Text>
            </View>
            <Switch
              value={showMe}
              onValueChange={handleShowMeToggle}
              trackColor={{ false: colors.gray300, true: colors.accent }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Show me on JuNubin"
            />
          </View>

          {/* Was gated behind the Junub tier. The app is free, so
              private browsing is simply available to everyone —
              paywalling a privacy control was never defensible. */}
          <View style={styles.switchRow}>
            <View style={styles.switchRowText}>
              <Text style={styles.rowLabel}>Incognito mode</Text>
              <Text style={styles.rowDesc}>
                Browse the directory and map without appearing in other people's results.
              </Text>
            </View>
            <Switch
              value={incognito}
              onValueChange={setIncognito}
              trackColor={{ false: colors.gray300, true: colors.accent }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Incognito mode"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchRowText}>
              <Text style={styles.rowLabel}>Distance unit</Text>
              <Text style={styles.rowDesc}>
                {distanceUnit === 'mi' ? 'Miles' : 'Kilometers'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.unitToggle}
              onPress={() => setDistanceUnit(u => u === 'mi' ? 'km' : 'mi')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Distance unit: ${distanceUnit === 'mi' ? 'miles' : 'kilometers'}. Tap to switch.`}
            >
              <Text style={styles.unitToggleText}>{distanceUnit.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          {renderRow({ label: 'Find friends', onPress: () => navigation.navigate('FindFriends') })}
          {/* Invite Friends hides until REFERRALS_BACKEND_READY flips
              true — the reward grants are local-only today and would let
              a user generate free rewards client-side. */}
          {REFERRALS_BACKEND_READY &&
            renderRow({ label: 'Invite friends', onPress: () => navigation.navigate('Referral') })}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <BrandLogo size="small" />
          <Text style={styles.footerVersion}>Version 1.0.0 (build: 1)</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    color: colors.black,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 30,
    gap: 22,
  },

  // ── Sections ──
  section: {},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.gray600,
    marginBottom: 9,
  },

  // ── Location visibility radio rows ──
  visOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  visOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint08,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioOuterActive: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.accent,
  },
  visOptionText: { flex: 1 },
  visOptionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: colors.black,
  },
  visOptionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray600,
    marginTop: 2,
  },

  // ── Temporary visibility chips ──
  visibleForBlock: {
    marginTop: 6,
  },
  visibleForLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: colors.black,
  },
  visibleForRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  visibleForChip: {
    height: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
  },
  visibleForChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  visibleForChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: colors.black,
  },
  visibleForChipTextActive: {
    color: colors.accentDark,
  },
  visibleForUntil: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray600,
    marginTop: 8,
  },
  footnote: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.gray600,
    marginTop: 10,
  },

  // ── Appearance / bordered toggle row ──
  borderedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
  },
  rowLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: colors.black,
  },
  rowDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray600,
    marginTop: 2,
  },

  // ── Flat chevron rows ──
  flatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    paddingHorizontal: 2,
  },
  flatRowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14.5,
    color: colors.black,
  },

  // ── Discovery switch rows ──
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    paddingHorizontal: 2,
  },
  switchRowText: { flex: 1 },
  unitToggle: {
    minWidth: 44,
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accentDark,
    letterSpacing: 0.5,
  },

  // ── Footer ──
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  footerVersion: {
    ...Typography.caption,
    color: colors.gray600,
    fontFamily: FontFamily.regular,
  },
});
