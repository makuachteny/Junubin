// Settings — flattened single screen with in-screen sub-views
// (claude.ai/design "JuNubin Redesign", Settings overlay).
//
// One route, six views: main, verify, blocked, notifs, help, del.
// The header back button pops the sub-view first, then closes the
// screen — sub-views are component state, not navigation routes, so
// the whole surface stays a single stack entry.
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, FontFamily, getShadow } from '../theme';
import Blueprint from '../components/Blueprint';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import * as safetyService from '../api/services/safetyService';
import { supabase } from '../config/supabase';
import { imageSource } from '../utils/imageSource';
import { layoutForWidth } from '../theme/layout';
import {
  promptForPushPermission,
  getNotificationPermissionStatus,
} from '../utils/notifications';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { LOCATION_VISIBILITY } from '../utils/locationConsent';

// Per-category push toggles. Local-only for now — there is no
// notification-prefs column server-side yet, so these persist on the
// device and default to on. The OS-level permission stays the real
// gate; flipping a toggle on while the OS permission is missing walks
// the user through the prompt / system-settings path.
const NOTIF_PREFS_KEY = '@junubin_notif_prefs';
const NOTIF_TOGGLES = [
  { key: 'requests', label: 'Message requests' },
  { key: 'messages', label: 'New messages' },
  { key: 'follows', label: 'New followers' },
  { key: 'nearby', label: 'People-nearby digest' },
];
const NOTIF_DEFAULTS = { requests: true, messages: true, follows: true, nearby: false };

// ── Location visibility ─────────────────────────────────────────────
// The design's three levels, in the design's order, each pinned to the
// value stored in `Profile.locationVisibility`. This list is the only
// place the design copy ↔ stored value mapping lives; everything else
// (radio cards, hydration, persistence) reads it.
//
// 'mutuals' is being added to the column's CHECK constraint and to
// discover-nearby by the backend. Until that lands the DB rejects the
// write, `setLocationVisibility` reverts, and the user is told — the
// constraint is fail-closed, so nobody can be made visible under a
// level the server does not yet enforce.
const VISIBILITY_MUTUALS = 'mutuals';

const VIS_OPTIONS = [
  {
    value: LOCATION_VISIBILITY.COARSE,
    label: 'Everyone on JuNubin',
    sub: 'Your approximate area shows on the Nearby map.',
  },
  {
    value: VISIBILITY_MUTUALS,
    label: 'Mutual follows only',
    sub: 'Only people you both follow can see your area.',
  },
  {
    value: LOCATION_VISIBILITY.OFF,
    label: 'Nobody',
    sub: 'You browse the map; you never appear on it.',
  },
];

// 'city' predates the design's three levels but is still persisted for
// anyone who picked it during onboarding. It is rendered only while it
// IS the stored value, so the design's three cards are what everyone
// else sees — and nobody's existing setting is silently rewritten or
// mislabelled as a level it isn't. Ordered by exposure, so it sits
// between "Everyone" and "Mutual follows only".
const LEGACY_CITY_OPTION = {
  value: LOCATION_VISIBILITY.CITY,
  label: 'City only',
  sub: 'People see your city, never a map pin.',
};

const KNOWN_VISIBILITY = new Set([
  ...VIS_OPTIONS.map((o) => o.value),
  LOCATION_VISIBILITY.CITY,
]);

const SUBVIEW_TITLES = {
  verify: 'Verify your photo',
  blocked: 'Blocked people',
  notifs: 'Notifications',
  help: 'Help & policies',
  del: 'Delete account',
};

const HELP_ROWS = [
  { label: 'FAQ', pageKey: 'faq' },
  { label: 'Contact us', pageKey: 'contact' },
  { label: 'Terms of use', pageKey: 'terms' },
  { label: 'Privacy policy', pageKey: 'privacy' },
  { label: 'Community guidelines', pageKey: 'guidelines' },
  { label: 'Safety tips', pageKey: 'safety' },
];

// 44×26 track switch from the design — accent when on, 20px knob in
// the page background color. RN's native Switch renders differently
// per platform; the design's toggle is part of the visual language,
// so it's drawn by hand. Purely visual — the row that contains it is
// the switch for touch and screen readers.
function TrackSwitch({ value, colors, isDark }) {
  return (
    <View
      style={[
        trackStyles.track,
        { backgroundColor: value ? colors.accent : colors.gray300 },
      ]}
      pointerEvents="none"
    >
      <View
        style={[
          trackStyles.knob,
          getShadow('sm', isDark),
          { backgroundColor: colors.cream, left: value ? 21 : 3 },
        ]}
      />
    </View>
  );
}

const trackStyles = StyleSheet.create({
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, session } = useAuth();
  const { currentUser } = useCurrentUser();
  const layout = useMemo(() => layoutForWidth(width), [width]);
  const styles = useMemo(() => getStyles(colors, layout), [colors, layout]);

  // null = main list; otherwise 'verify' | 'blocked' | 'notifs' |
  // 'help' | 'del'.
  const [view, setView] = useState(null);

  // ── Location visibility ─────────────────────────────────────────
  // Source of truth is `Profile.locationVisibility` (00047) — 'off' |
  // 'city' | 'coarse' (+ 'mutuals' once the backend lands), defaulting
  // to 'off'. The legacy `Profile.shareLocation` boolean is kept in
  // sync by a DB trigger, so we only ever write the new column here.
  const [locationVisibility, setLocationVisibilityState] = useState(LOCATION_VISIBILITY.OFF);
  // Temporary sharing window (`Profile.locationVisibleUntil`, 00047).
  // null = visible until manually disabled; a future ISO timestamp
  // means "visible until then", after which discover-nearby hides the
  // user server-side with no cron needed.
  const [visibleUntil, setVisibleUntilState] = useState(null);

  // Location visibility is server-only (no AsyncStorage cache) — the
  // brief flash of 'off' before the server fetch lands errs toward
  // hidden, which is the right way to be wrong. Falls back to the
  // legacy boolean for a client running against a pre-00047 DB.
  useEffect(() => {
    const profile = currentUser?.profile;
    const stored = profile?.locationVisibility;

    // An expired temporary window means the server already treats this
    // user as hidden. Reconcile the stored state to match so the radio
    // group doesn't claim a visibility level nobody can see.
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

    if (KNOWN_VISIBILITY.has(stored)) {
      setLocationVisibilityState(stored);
    } else {
      setLocationVisibilityState(
        profile?.shareLocation ? LOCATION_VISIBILITY.COARSE : LOCATION_VISIBILITY.OFF,
      );
    }
  }, [currentUser?.profile?.locationVisibility, currentUser?.profile?.shareLocation, currentUser?.profile?.locationVisibleUntil]);

  // Persist on change with revert-on-failure — writing this column is
  // what makes someone discoverable, so a failed save must not leave
  // the UI claiming a visibility level the server never accepted.
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
      // The column's CHECK constraint is what tells us 'mutuals' has
      // not shipped yet. Say so plainly instead of surfacing a Postgres
      // constraint name.
      const rejected = /constraint|check|invalid|violat/i.test(e?.message || '');
      Alert.alert(
        'Could not update',
        next === VISIBILITY_MUTUALS && rejected
          ? "Mutual-follows visibility isn't available yet — your setting hasn't changed."
          : e?.message || 'Try again when you have a connection.',
      );
    }
  }, [locationVisibility, visibleUntil]);

  // Temporary-visibility window. `hours` = 1 | 8 | null (no limit).
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

  // ── Notification toggles ────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState(NOTIF_DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(NOTIF_PREFS_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        setNotifPrefs({ ...NOTIF_DEFAULTS, ...JSON.parse(raw) });
      } catch {}
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const toggleNotifPref = useCallback(async (key) => {
    const turningOn = !notifPrefs[key];
    const next = { ...notifPrefs, [key]: turningOn };
    setNotifPrefs(next);
    AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next)).catch(() => {});
    // A toggle only means something if the OS lets us deliver at all.
    // Turning any category on with permission missing walks the user
    // through the prompt (undetermined) or system settings (denied).
    if (turningOn) {
      try {
        const status = await getNotificationPermissionStatus();
        if (status === 'denied') {
          promptToOpenSettings({
            title: 'Notifications turned off',
            message: 'Open Settings to let JuNubin send you push notifications.',
          });
        } else if (status !== 'granted') {
          await promptForPushPermission();
        }
      } catch {}
    }
  }, [notifPrefs]);

  // ── Blocked people ──────────────────────────────────────────────
  // null = not fetched yet (loading); [] = fetched, empty.
  const [blockedRows, setBlockedRows] = useState(null);

  const loadBlocked = useCallback(async () => {
    setBlockedRows(null);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { setBlockedRows([]); return; }
      const { data: appUser } = await supabase
        .from('User')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();
      if (!appUser) { setBlockedRows([]); return; }
      const { data: rows, error } = await supabase
        .from('Block')
        .select('blockedId, blocked:User!blockedId(id, displayName, photos:Photo(url, sortOrder))')
        .eq('blockerId', appUser.id);
      if (error) throw error;
      setBlockedRows((rows || []).map((r) => {
        const photos = Array.isArray(r.blocked?.photos) ? [...r.blocked.photos] : [];
        photos.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return {
          id: r.blockedId,
          name: r.blocked?.displayName || 'Someone',
          photo: photos[0]?.url || null,
        };
      }));
    } catch {
      // Degrade to the empty state rather than stranding a spinner —
      // the copy still tells the user how blocking works.
      setBlockedRows([]);
    }
  }, []);

  useEffect(() => {
    if (view === 'blocked') loadBlocked();
  }, [view, loadBlocked]);

  const handleUnblock = useCallback(async (row) => {
    try {
      await safetyService.unblockUser(row.id);
      setBlockedRows((prev) => (prev || []).filter((r) => r.id !== row.id));
    } catch (e) {
      Alert.alert('Could not unblock', e?.message || 'Try again.');
    }
  }, []);

  // ── Log out / delete account ────────────────────────────────────
  const handleLogout = useCallback(() => {
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
          },
        },
      ],
    );
  }, [logout]);

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
            // tears down storage objects, the User row (FK cascades
            // the rest), and the auth.users row. App Store guideline
            // 5.1.1.v requires "real" deletion; soft-deletes leave
            // the account discoverable, which violates it.
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
            // sign-out still happens.
            if (!serverDeleted) {
              try {
                if (session) {
                  await profileService.updateProfile({ deletedAt: new Date().toISOString() });
                }
              } catch {}
            }
            await logout();
          },
        },
      ],
    );
  }, [session, logout]);

  const isVerified = !!(currentUser?.verified || currentUser?.profile?.isVerified);

  // The design's three cards, plus the legacy 'city' card only while it
  // is the value this account actually has stored.
  const visOptions = useMemo(() => (
    locationVisibility === LOCATION_VISIBILITY.CITY
      ? [VIS_OPTIONS[0], LEGACY_CITY_OPTION, ...VIS_OPTIONS.slice(1)]
      : VIS_OPTIONS
  ), [locationVisibility]);

  // Which duration chip is live. Derived from the stored timestamp
  // rather than a separate piece of state, so it survives a reload and
  // can't drift from what the server will actually enforce.
  const activeWindowHours = useMemo(() => {
    if (!visibleUntil) return null;
    const hoursLeft = (new Date(visibleUntil).getTime() - Date.now()) / 3600_000;
    return hoursLeft <= 1.05 ? 1 : 8;
  }, [visibleUntil]);

  const accountRows = useMemo(() => [
    {
      label: isVerified ? 'Verify your photo — done ✓' : 'Verify your photo',
      onPress: () => setView('verify'),
    },
    { label: 'Blocked people', onPress: () => setView('blocked') },
    { label: 'Notifications', onPress: () => setView('notifs') },
    { label: 'Help, terms & safety', onPress: () => setView('help') },
    { label: 'Log out', onPress: handleLogout },
    { label: 'Delete account', destructive: true, onPress: () => setView('del') },
  ], [isVerified, handleLogout]);

  // Back pops the sub-view first, then closes the screen.
  const handleBack = useCallback(() => {
    if (view) setView(null);
    else navigation.goBack();
  }, [view, navigation]);

  const renderChevronRow = (row) => (
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

  // ── Sub-view bodies ─────────────────────────────────────────────

  const renderMain = () => (
    <>
      {/* LOCATION VISIBILITY — three explicit levels rather than a
          single on/off switch. Hidden is the default and stays the
          default. */}
      <View>
        <Text style={styles.sectionLabel}>LOCATION VISIBILITY</Text>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {visOptions.map((opt) => {
            const selected = locationVisibility === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.visOption, selected && styles.visOptionActive]}
                onPress={() => setLocationVisibility(opt.value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.label}. ${opt.sub}`}
                testID={`location-visibility-${opt.value}`}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visOptionLabel}>{opt.label}</Text>
                  <Text style={styles.visOptionDesc}>{opt.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Temporary visibility — only meaningful when the user is
            visible at all. "1 hour" / "8 hours" write a future
            locationVisibleUntil; discover-nearby drops the user the
            moment it passes, and the hydrate effect flips the radio
            back to Nobody on the next visit. */}
        {locationVisibility !== LOCATION_VISIBILITY.OFF && (
          <View style={styles.visibleForBlock}>
            <Text style={styles.visibleForLabel}>STAY VISIBLE FOR</Text>
            <View style={styles.visibleForRow} accessibilityRole="radiogroup">
              {[
                { hours: 1, label: '1 hour' },
                { hours: 8, label: '8 hours' },
                { hours: null, label: 'Until I turn it off' },
              ].map((opt) => {
                const selected = opt.hours === activeWindowHours;
                return (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.visibleForChip, selected && styles.visibleForChipActive]}
                    onPress={() => setTemporaryWindow(opt.hours)}
                    activeOpacity={0.85}
                    hitSlop={{ top: 4, bottom: 4 }}
                    accessibilityRole="radio"
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
                {' — after that you go back to Nobody automatically.'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* APPEARANCE */}
      <View>
        <Text style={styles.sectionLabel}>APPEARANCE</Text>
        <TouchableOpacity
          style={styles.borderedRow}
          onPress={toggleTheme}
          activeOpacity={0.8}
          accessibilityRole="switch"
          accessibilityState={{ checked: isDark }}
          accessibilityLabel="Dark mode"
        >
          <Text style={styles.rowLabel}>Dark mode</Text>
          <TrackSwitch value={isDark} colors={colors} isDark={isDark} />
        </TouchableOpacity>
      </View>

      {/* ACCOUNT & SAFETY */}
      <View>
        <Text style={styles.sectionLabel}>ACCOUNT & SAFETY</Text>
        <View>{accountRows.map(renderChevronRow)}</View>
      </View>
    </>
  );

  const renderVerify = () => (
    <View style={styles.verifyWrap}>
      <Ionicons name="shield-checkmark-outline" size={46} color={colors.accentDark} />
      <Text style={styles.verifyBody}>
        A quick selfie proves you're a real person. It's compared to your profile photo,
        then deleted. Verified profiles get a badge everywhere.
      </Text>
      {isVerified ? (
        <View style={styles.verifiedChip}>
          <Ionicons name="checkmark" size={17} color={colors.accentDark} />
          <Text style={styles.verifiedChipText}>You're verified</Text>
        </View>
      ) : (
        <Blueprint style={{ width: '100%' }}>
          <TouchableOpacity
            style={styles.goldCta}
            onPress={() => navigation.navigate('PhotoVerification')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Take verification selfie"
          >
            <Text style={styles.goldCtaText}>TAKE VERIFICATION SELFIE</Text>
          </TouchableOpacity>
        </Blueprint>
      )}
    </View>
  );

  const renderBlocked = () => {
    if (blockedRows === null) {
      return <ActivityIndicator style={{ marginTop: 44 }} color={colors.accent} />;
    }
    if (blockedRows.length === 0) {
      return (
        <Text style={styles.blockedEmpty}>
          You haven't blocked anyone.{'\n'}Block from the ⋯ menu on any profile — they're never told.
        </Text>
      );
    }
    return (
      <View>
        {blockedRows.map((row) => (
          <View key={row.id} style={styles.blockedRow}>
            <Image source={imageSource(row.photo)} style={styles.blockedAvatar} />
            <Text style={styles.blockedName} numberOfLines={1}>{row.name}</Text>
            <TouchableOpacity
              style={styles.unblockBtn}
              onPress={() => handleUnblock(row)}
              activeOpacity={0.7}
              // Design draws this button 34pt tall; hitSlop restores the
              // 44pt target without changing the drawing.
              hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${row.name}`}
            >
              <Text style={styles.unblockText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderNotifs = () => (
    <>
      <View>
        {NOTIF_TOGGLES.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={styles.notifRow}
            onPress={() => toggleNotifPref(t.key)}
            activeOpacity={0.8}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!notifPrefs[t.key] }}
            accessibilityLabel={t.label}
            testID={`notif-${t.key}`}
          >
            <Text style={styles.rowLabel}>{t.label}</Text>
            <TrackSwitch value={!!notifPrefs[t.key]} colors={colors} isDark={isDark} />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.notifFootnote}>
        Push only — JuNubin never emails or texts you about activity.
      </Text>
    </>
  );

  const renderHelp = () => (
    <View>
      {HELP_ROWS.map((row) => renderChevronRow({
        label: row.label,
        onPress: () => navigation.navigate('SettingsInfo', { pageKey: row.pageKey }),
      }))}
    </View>
  );

  const renderDelete = () => (
    <Blueprint style={styles.deleteCard}>
      <Text style={styles.deleteTitle}>This can't be undone</Text>
      <Text style={styles.deleteBody}>
        Your profile, follows and chats are deleted within 24 hours. People you messaged
        keep their copy of the conversation.
      </Text>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={handleDeleteAccount}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
      >
        <Text style={styles.deleteBtnText}>Delete my account</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={() => setView(null)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
      >
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </Blueprint>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{SUBVIEW_TITLES[view] || 'Settings'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!view && renderMain()}
        {view === 'verify' && renderVerify()}
        {view === 'blocked' && renderBlocked()}
        {view === 'notifs' && renderNotifs()}
        {view === 'help' && renderHelp()}
        {view === 'del' && renderDelete()}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, layout) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 6,
    ...layout.centeredContent,
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
    paddingHorizontal: layout.horizontal,
    paddingTop: 6,
    paddingBottom: 30,
    gap: 22,
    ...layout.centeredContent,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.96, // design .08em
    color: colors.gray500,
    marginBottom: 9,
  },

  // ── Location visibility radio cards ──
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
  },
  visOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
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
  visOptionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: colors.black,
  },
  visOptionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray500,
    marginTop: 2,
  },

  // ── Temporary visibility (required privacy control, folded in
  //    quietly under the section in the design's language) ──
  visibleForBlock: {
    marginTop: 12,
  },
  visibleForLabel: {
    fontSize: 10.5,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.84,
    color: colors.gray400,
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
    backgroundColor: colors.accentSurface,
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
    color: colors.gray500,
    marginTop: 8,
  },

  // ── Appearance ──
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

  // ── Flat chevron rows ──
  flatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // minHeight, not height — the design's 50pt row must grow rather
    // than clip when the OS text size is turned up.
    minHeight: 50,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    paddingHorizontal: 2,
  },
  flatRowLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14.5,
    color: colors.black,
  },

  // ── Verify sub-view ──
  verifyWrap: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 24,
  },
  verifyBody: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 22.5, // design 1.55
    color: colors.gray500,
    textAlign: 'center',
    maxWidth: 260, // design 32ch
  },
  goldCta: {
    height: 52,
    backgroundColor: colors.ssGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldCtaText: {
    fontSize: 17,
    letterSpacing: 1.36,
    fontFamily: FontFamily.headingBold,
    color: colors.onGold,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 4,
    backgroundColor: colors.roseTint12, // design: accent at 12%
  },
  verifiedChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14.5,
    color: colors.accentDark,
  },

  // ── Blocked sub-view ──
  blockedEmpty: {
    textAlign: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.gray400,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  blockedAvatar: {
    width: 44,
    height: 44,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.creamDark,
  },
  blockedName: {
    flex: 1,
    fontFamily: FontFamily.heading,
    fontSize: 17,
    color: colors.black,
  },
  unblockBtn: {
    height: 34,
    paddingHorizontal: 13,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
  },
  unblockText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12.5,
    color: colors.black,
  },

  // ── Notifications sub-view ──
  notifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 54,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    paddingHorizontal: 2,
  },
  notifFootnote: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.gray400,
  },

  // ── Delete sub-view ──
  deleteCard: {
    padding: 18,
    gap: 12,
    marginTop: 12,
  },
  deleteTitle: {
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    letterSpacing: 0.54, // design .03em
    color: colors.black,
  },
  deleteBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 21, // design 1.55
    color: colors.gray500,
  },
  deleteBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 4,
  },
  deleteBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: colors.error,
  },
  cancelBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
  },
  cancelBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: colors.black,
  },
});
