// HomeScreen — "Where are my South Sudanese people?"
//
// This is the location-first home of the app. It answers one question:
// who is near me, or near the city I care about. It is deliberately NOT
// a feed and NOT a swipe deck — there is no like, pass, super-like or
// match anywhere on this screen.
//
// Industry redesign: the map is FULL-BLEED — it fills the entire tab
// under the status bar, and all chrome floats on top of it:
//   row 1 — a Blueprint city pill (city + visible count) and a Map|List
//           segmented control
//   row 2 — quick filter chips (Everyone / Verified / Active this week)
// List mode swaps the map for a full-screen list under the same
// floating chrome.
//
// Privacy contract: this screen never triggers the OS location prompt
// on its own. PeopleMap owns that, and only after the user has accepted
// the in-app disclosure (see utils/locationConsent.js). Someone who
// declines still gets a fully working list view — browsing is never
// gated on giving up your location.

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Typography, FontFamily } from '../theme';
import PeopleMap from '../components/PeopleMap';
import Blueprint from '../components/Blueprint';
import Button from '../components/Button';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as directoryService from '../api/services/directoryService';
import * as followService from '../api/services/followService';
import { imageSource } from '../utils/imageSource';
import { reportError } from '../utils/reportError';
import { trackEvent } from '../utils/analytics';
import { hapticSelection } from '../utils/haptics';
import {
  getLocationDisclosureAccepted,
  setLocationDisclosureAccepted,
  locationVisibilityLabel,
} from '../utils/locationConsent';

const VIEW_MODE_KEY = '@junubin/home_view_mode_v1';

// Quick filter chips. Everything here is free — there is no paid filter
// tier in JuNubin, so no chip is ever locked.
const QUICK_FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'verified', label: 'Verified' },
  { key: 'active', label: 'Active this week' },
];

// Height of the two floating chrome rows (pill row + chip row + gaps),
// excluding the safe-area inset and the optional city search row. The
// list content and PeopleMap's own overlays pad by this so nothing
// hides under the chrome.
const CHROME_ROWS_H = 8 + 36 + 9 + 34 + 10;
const SEARCH_ROW_H = 48;

const isActiveThisWeek = (person) => {
  if (!person?.lastActiveAt) return false;
  const days = (Date.now() - new Date(person.lastActiveAt).getTime()) / 8.64e7;
  return Number.isFinite(days) && days <= 7;
};

// "distance · profession" meta line for a list row. Directory results
// don't carry a live distance, so the city stands in for it.
const personMeta = (person) => {
  const openTo = Array.isArray(person.openTo) && person.openTo.length > 0
    ? `Open to ${person.openTo.join(', ')}`
    : null;
  return [person.city, person.profession || openTo].filter(Boolean).join(' · ');
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();

  // null = still reading AsyncStorage. We must not mount PeopleMap
  // before we know, because mounting it is what leads to the OS prompt.
  const [disclosureAccepted, setDisclosureAccepted] = useState(null);
  // Set when the user taps "Not now". Keeps them in the list view for
  // this session without nagging, but leaves the door open in Settings.
  const [disclosureDismissed, setDisclosureDismissed] = useState(false);

  const [viewMode, setViewMode] = useState('map');
  const [viewModeHydrated, setViewModeHydrated] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [cityInput, setCityInput] = useState('');
  const [cityQuery, setCityQuery] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [followingIds, setFollowingIds] = useState(() => new Set());
  // Count of pins currently visible on the map, reported by PeopleMap
  // so the city pill can show "N visible" in both modes.
  const [mapCount, setMapCount] = useState(0);
  const cursorRef = useRef(null);

  // ── Disclosure + persisted view mode ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accepted, storedMode] = await Promise.all([
        getLocationDisclosureAccepted(),
        AsyncStorage.getItem(VIEW_MODE_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      setDisclosureAccepted(accepted);
      if (storedMode === 'map' || storedMode === 'list') setViewMode(storedMode);
      setViewModeHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const changeViewMode = useCallback((next) => {
    hapticSelection();
    setViewMode(next);
    trackEvent('home_view_mode', { mode: next });
    AsyncStorage.setItem(VIEW_MODE_KEY, next).catch(() => {});
  }, []);

  // ── People list ──
  // Used by the list view. Sourced from the directory so it works with
  // or without location permission.
  const loadPeople = useCallback(async ({ append = false } = {}) => {
    if (!session) { setPeople([]); return; }
    if (!append) setLoading(true);
    setLoadError(false);
    try {
      const { people: results, nextCursor } = await directoryService.searchDirectory({
        city: cityQuery || undefined,
        verifiedOnly: quickFilter === 'verified' || undefined,
        cursor: append ? cursorRef.current : undefined,
        limit: 24,
      });
      cursorRef.current = nextCursor || null;
      setPeople((prev) => (append ? [...prev, ...(results || [])] : (results || [])));
    } catch (err) {
      reportError('HomeScreen.loadPeople', err, { city: cityQuery, quickFilter });
      if (!append) setPeople([]);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session, cityQuery, quickFilter]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    cursorRef.current = null;
    loadPeople();
  }, [viewMode, loadPeople]);

  // Hydrate follow state for whoever is on screen so the button doesn't
  // lie about people the user already follows.
  useEffect(() => {
    if (!session || people.length === 0) return;
    let cancelled = false;
    followService.checkFollowStatus(people.map((p) => p.id))
      .then((set) => { if (!cancelled) setFollowingIds(set); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session, people]);

  // Refresh the list when the user comes back from a profile — they may
  // have followed or blocked someone while they were away.
  const firstFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocusRef.current) { firstFocusRef.current = false; return undefined; }
      if (viewMode === 'list') loadPeople();
      return undefined;
    }, [viewMode, loadPeople]),
  );

  const visiblePeople = useMemo(() => {
    if (quickFilter === 'active') return people.filter(isActiveThisWeek);
    if (quickFilter === 'verified') return people.filter((p) => p.verified);
    return people;
  }, [people, quickFilter]);

  // ── Handlers ──
  const openProfile = useCallback((person) => {
    navigation?.navigate?.('ProfileDetail', {
      profile: { ...person, images: person.images || person.photos || [] },
    });
  }, [navigation]);

  const handleFollow = useCallback(async (person) => {
    if (!person?.id) return;
    const already = followingIds.has(person.id);
    // Optimistic — the row is a list item, a spinner here would be noise.
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (already) next.delete(person.id); else next.add(person.id);
      return next;
    });
    try {
      if (already) await followService.unfollowUser(person.id);
      else await followService.followUser(person.id);
      trackEvent(already ? 'unfollow' : 'follow', { surface: 'home' });
    } catch (err) {
      reportError('HomeScreen.follow', err, { targetId: person.id });
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (already) next.add(person.id); else next.delete(person.id);
        return next;
      });
    }
  }, [followingIds]);

  const submitCity = useCallback(() => {
    const trimmed = cityInput.trim();
    setCityQuery(trimmed || null);
    cursorRef.current = null;
    if (trimmed) {
      trackEvent('home_city_search');
      // A city search is a browse action — show it as a list.
      if (viewMode !== 'list') changeViewMode('list');
    }
  }, [cityInput, viewMode, changeViewMode]);

  const clearCity = useCallback(() => {
    setCityInput('');
    setCityQuery(null);
    cursorRef.current = null;
  }, []);

  const acceptDisclosure = useCallback(async () => {
    await setLocationDisclosureAccepted(true);
    setDisclosureAccepted(true);
    trackEvent('location_disclosure_accepted');
  }, []);

  const declineDisclosure = useCallback(() => {
    setDisclosureDismissed(true);
    changeViewMode('list');
    trackEvent('location_disclosure_declined');
  }, [changeViewMode]);

  // ── Render ──
  const myCity = currentUser?.city || currentUser?._raw?.city;
  const pillCity = cityQuery || myCity || 'Nearby';
  const visibleCount = viewMode === 'map' ? mapCount : visiblePeople.length;
  const myVisibility = locationVisibilityLabel(
    currentUser?.locationVisibility || currentUser?.profile?.locationVisibility,
  ).toLowerCase();

  const chromeH = insets.top + CHROME_ROWS_H + (searchOpen ? SEARCH_ROW_H : 0);

  const renderRow = ({ item }) => {
    const following = followingIds.has(item.id);
    const nameAge = item.age ? `${item.name}, ${item.age}` : item.name;
    return (
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => openProfile(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}'s photo`}
        >
          <Image
            source={imageSource(item.images?.[0] || item.photos?.[0])}
            style={styles.rowPhoto}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rowBody}
          onPress={() => openProfile(item)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.name}'s profile`}
        >
          <View style={styles.rowNameLine}>
            <Text style={styles.rowName} numberOfLines={1}>{nameAge}</Text>
            {item.verified ? (
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={colors.accentDark}
                accessibilityLabel="Verified"
              />
            ) : null}
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>{personMeta(item)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.followBtn, following && styles.followBtnActive]}
          onPress={() => handleFollow(item)}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={following ? `Unfollow ${item.name}` : `Follow ${item.name}`}
          accessibilityState={{ selected: following }}
        >
          <Text style={[styles.followText, following && styles.followTextActive]}>
            {following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderList = () => (
    <FlatList
      data={visiblePeople}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderRow}
      contentContainerStyle={visiblePeople.length === 0
        ? [styles.listEmptyWrap, { paddingTop: chromeH }]
        : [styles.listContent, { paddingTop: chromeH + 4 }]}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (!loading && cursorRef.current) loadPeople({ append: true });
      }}
      refreshControl={(
        <ThemedRefreshControl
          refreshing={refreshing}
          progressViewOffset={chromeH}
          onRefresh={() => { setRefreshing(true); cursorRef.current = null; loadPeople(); }}
        />
      )}
      ListFooterComponent={visiblePeople.length > 0 ? (
        <TouchableOpacity
          style={styles.listFooter}
          onPress={() => navigation?.navigate?.('Settings')}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Your visibility is ${myVisibility}. Open settings to change it.`}
        >
          <Text style={styles.listFooterText}>
            Showing people who chose to be visible ·{' '}
            <Text style={styles.listFooterLink}>your visibility: {myVisibility}</Text>
          </Text>
        </TouchableOpacity>
      ) : null}
      ListEmptyComponent={loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyBox}>
            <Ionicons
              name={loadError ? 'cloud-offline-outline' : 'people-outline'}
              size={30}
              color={colors.accent}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {loadError
              ? "Couldn't load people"
              : cityQuery ? `Nobody in ${cityQuery} yet` : 'Nobody here yet'}
          </Text>
          <Text style={styles.emptySub}>
            {loadError
              ? 'Check your connection and try again.'
              : cityQuery
                ? 'Try a nearby city, or search the full directory.'
                : 'JuNubin is new in your area. Search the directory to find people anywhere in the diaspora.'}
          </Text>
          <View style={styles.emptyActions}>
            {loadError ? (
              <Button title="Try again" variant="primary" size="md" fullWidth onPress={() => loadPeople()} />
            ) : (
              <Button
                title="Search the directory"
                variant="primary"
                size="md"
                fullWidth
                onPress={() => navigation?.navigate?.('DirectoryTab')}
              />
            )}
            {cityQuery ? (
              <Button title="Clear city" variant="outline" size="md" fullWidth onPress={clearCity} />
            ) : null}
          </View>
        </View>
      )}
    />
  );

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ─── FULL-BLEED BODY ───
          The map (or the list) owns the whole tab; chrome floats on top.
          PeopleMap renders the location disclosure itself and only asks
          the OS once the user has accepted it. `onDecline` drops them
          into the list so the tab is never a dead end. */}
      <View style={StyleSheet.absoluteFill}>
        {!viewModeHydrated || disclosureAccepted === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: chromeH + 32 }} />
        ) : viewMode === 'list' ? (
          renderList()
        ) : (
          <PeopleMap
            topInset={chromeH}
            quickFilter={quickFilter}
            onVisibleCountChange={setMapCount}
            disclosureAccepted={disclosureAccepted && !disclosureDismissed}
            onDisclosureAccept={acceptDisclosure}
            onDisclosureDecline={declineDisclosure}
            onBrowseList={() => changeViewMode('list')}
            onPersonPress={(person) => navigation?.navigate?.('ProfileDetail', {
              profile: { ...person, images: person.photos || person.images || [] },
            })}
          />
        )}
      </View>

      {/* ─── FLOATING CHROME ─── */}
      <View
        style={[styles.chrome, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.chromeRow} pointerEvents="box-none">
          <TouchableOpacity
            onPress={() => setSearchOpen((v) => !v)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${pillCity}, ${visibleCount} visible. Search a different city.`}
            accessibilityState={{ expanded: searchOpen }}
            testID="home-city-pill"
          >
            <Blueprint style={styles.cityPill}>
              <Text style={styles.cityPillName} numberOfLines={1}>{pillCity}</Text>
              <Text style={styles.cityPillCount}>{visibleCount} visible</Text>
              <Ionicons name="chevron-down" size={14} color={colors.gray500} />
            </Blueprint>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <View style={styles.segmented}>
            {['map', 'list'].map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.segment,
                  i > 0 && styles.segmentDivider,
                  viewMode === m && styles.segmentActive,
                ]}
                onPress={() => changeViewMode(m)}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === m }}
                accessibilityLabel={m === 'map' ? 'Map view' : 'List view'}
                testID={`home-view-${m}`}
              >
                <Text style={[styles.segmentText, viewMode === m && styles.segmentTextActive]}>
                  {m === 'map' ? 'Map' : 'List'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.chipRow} pointerEvents="box-none">
          {QUICK_FILTERS.map((f) => {
            const selected = quickFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, selected && styles.chipActive]}
                onPress={() => setQuickFilter(f.key)}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Filter: ${f.label}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {searchOpen ? (
          <View style={styles.searchRow}>
            <Ionicons name="search" size={15} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              value={cityInput}
              onChangeText={setCityInput}
              onSubmitEditing={submitCity}
              placeholder="Search a city"
              placeholderTextColor={colors.gray400}
              returnKeyType="search"
              autoCorrect={false}
              autoFocus
              accessibilityLabel="Search people by city"
              testID="home-city-search"
            />
            {cityInput.length > 0 ? (
              <TouchableOpacity
                onPress={clearCity}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear city search"
              >
                <Ionicons name="close-circle" size={15} color={colors.gray400} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },

  // ─── Floating chrome ───
  chrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    gap: 9,
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cream,
    paddingVertical: 8,
    paddingHorizontal: 13,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.4 : 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cityPillName: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    letterSpacing: 0.3,
    color: colors.black,
    maxWidth: 140,
  },
  cityPillCount: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: colors.gray500,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segment: {
    height: 36,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.separator,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: colors.black,
  },
  segmentTextActive: {
    color: colors.cream,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 7,
  },
  // Quick chips over the map: selected is SOLID accent with cream text
  // (stronger than the standard tinted chip — they sit on a busy map).
  chip: {
    height: 34,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.cream,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12.5,
    color: colors.black,
  },
  chipTextActive: {
    color: colors.cream,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
    backgroundColor: colors.cream,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: colors.black,
    padding: 0,
  },

  // ─── List mode ───
  listContent: {
    paddingBottom: 24,
  },
  listEmptyWrap: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowPhoto: {
    width: 56,
    height: 56,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.gray200,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: colors.black,
    flexShrink: 1,
  },
  rowMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: colors.gray500,
    marginTop: 2,
  },
  followBtn: {
    height: 36,
    minWidth: 86,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  followBtnActive: {
    borderColor: colors.separator,
    backgroundColor: 'transparent',
  },
  followText: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: colors.accentDark,
  },
  followTextActive: {
    color: colors.gray500,
  },
  listFooter: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: 'center',
  },
  listFooterText: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: colors.gray400,
    textAlign: 'center',
  },
  listFooterLink: {
    color: colors.accentDark,
    textDecorationLine: 'underline',
  },

  // ─── Empty / error states ───
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyBox: {
    width: 60,
    height: 60,
    borderRadius: 0,
    backgroundColor: colors.accentTint10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    ...Typography.h3,
    color: colors.black,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyActions: {
    marginTop: 20,
    width: '100%',
    gap: 10,
  },
});

export default HomeScreen;
