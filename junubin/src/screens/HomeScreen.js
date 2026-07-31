// HomeScreen — "Where are my South Sudanese people?"
//
// This is the location-first home of the app. It answers one question:
// who is near me, or near the city I care about. It is deliberately NOT
// a feed and NOT a swipe deck — there is no like, pass, super-like or
// match anywhere on this screen.
//
// Two surfaces, one dataset:
//   map  — PeopleMap, pins for people who opted into location visibility
//   list — the same people as rows, plus a city search for anyone who
//          denied location permission or simply prefers browsing
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
import PersonCard from '../components/PersonCard';
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
} from '../utils/locationConsent';

const VIEW_MODE_KEY = '@junubin/home_view_mode_v1';

// Quick filter chips. Everything here is free — there is no paid filter
// tier in JuNubin, so no chip is ever locked.
const QUICK_FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'verified', label: 'Verified' },
  { key: 'active', label: 'Active this week' },
];

const isActiveThisWeek = (person) => {
  if (!person?.lastActiveAt) return false;
  const days = (Date.now() - new Date(person.lastActiveAt).getTime()) / 8.64e7;
  return Number.isFinite(days) && days <= 7;
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, insets, isDark), [colors, insets, isDark]);
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

  const [cityInput, setCityInput] = useState('');
  const [cityQuery, setCityQuery] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [followingIds, setFollowingIds] = useState(() => new Set());
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
  // Used by the list view, and by the map's empty state. Sourced from
  // the directory so it works with or without location permission.
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
    navigation?.navigate?.('ProfileView', {
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
  const listTitle = cityQuery
    ? `People in ${cityQuery}`
    : myCity ? `People in ${myCity} and beyond` : 'People in the community';

  const renderList = () => (
    <FlatList
      data={visiblePeople}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <PersonCard
          person={item}
          onPress={openProfile}
          onFollow={handleFollow}
          isFollowing={followingIds.has(item.id)}
        />
      )}
      contentContainerStyle={visiblePeople.length === 0 ? styles.listEmptyWrap : styles.listContent}
      ListHeaderComponent={visiblePeople.length > 0 ? (
        <Text style={styles.listTitle}>{listTitle}</Text>
      ) : null}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (!loading && cursorRef.current) loadPeople({ append: true });
      }}
      refreshControl={(
        <ThemedRefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cursorRef.current = null; loadPeople(); }}
        />
      )}
      ListEmptyComponent={loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyCircle}>
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

      {/* ─── HEADER ───
          Deliberately two short rows, not three tall ones. This screen
          IS the map; chrome that pushes it below the fold is chrome
          that defeats the point. The title row doubles as the account
          bar, and the Map/List toggle rides on the search row as an
          icon pair rather than a full-width segmented control. */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Nearby</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('Notifications')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={colors.black} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('Profile')}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
            >
              <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.controlRow}>
          {/* City search — the primary way to browse without location. */}
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
              accessibilityLabel="Search people by city"
              testID="home-city-search"
            />
            {cityInput.length > 0 ? (
              <TouchableOpacity onPress={clearCity} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={15} color={colors.gray400} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.segmented}>
            {['map', 'list'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.segment, viewMode === m && styles.segmentActive]}
                onPress={() => changeViewMode(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === m }}
                accessibilityLabel={m === 'map' ? 'Map view' : 'List view'}
                testID={`home-view-${m}`}
              >
                <Ionicons
                  name={m === 'map' ? 'map-outline' : 'list-outline'}
                  size={16}
                  color={viewMode === m ? colors.white : colors.gray600}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick filters belong to the list only — the map has its own
            chip row, and stacking both would put four rows of chrome
            above the map. */}
        {viewMode === 'list' ? (
          <View style={styles.chips}>
            {QUICK_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, quickFilter === f.key && styles.chipActive]}
                onPress={() => setQuickFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: quickFilter === f.key }}
              >
                <Text style={[styles.chipText, quickFilter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      {/* ─── BODY ─── */}
      <View style={styles.body}>
        {!viewModeHydrated || disclosureAccepted === null ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : viewMode === 'list' ? (
          renderList()
        ) : (
          // PeopleMap renders the location disclosure itself and only
          // asks the OS once the user has accepted it. `onDecline`
          // drops them into the list so the tab is never a dead end.
          <PeopleMap
            topInset={8}
            disclosureAccepted={disclosureAccepted && !disclosureDismissed}
            onDisclosureAccept={acceptDisclosure}
            onDisclosureDecline={declineDisclosure}
            onBrowseList={() => changeViewMode('list')}
            onPersonPress={(person) => navigation?.navigate?.('ProfileView', {
              profile: { ...person, images: person.photos || person.images || [] },
            })}
          />
        )}
      </View>
    </View>
  );
};

const getStyles = (colors, insets, isDark) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
  },
  headerTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.black,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray200,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 34,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: colors.black,
    padding: 0,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  segment: {
    width: 34,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: colors.black,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.accentTint15,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: colors.gray600,
  },
  chipTextActive: {
    color: colors.accent,
  },
  body: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  listEmptyWrap: {
    flexGrow: 1,
  },
  listTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: colors.gray600,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
