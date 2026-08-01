// DirectoryScreen — the searchable South Sudanese diaspora directory.
//
// Home answers "who is near me". The directory answers "who is anywhere
// I care about": free-text search plus one quick facet — a city or
// "Verified only". Every filter is free; JuNubin has no paid tier, so
// nothing on this screen is locked, blurred or upsold.
//
// People appear in the directory only when `Profile.directoryVisible`
// is true and their account is active and unmoderated — the `directory`
// Edge Function enforces that server-side along with block filtering,
// so the client never has to be trusted with it.
//
// Visual language: Industry redesign, design.html Directory tab —
// compact header, hairline search field, single-select chip
// row, numbered Blueprint person cards. Tokens only, no hex.

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import Button from '../components/Button';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { useAuth } from '../auth';
import * as directoryService from '../api/services/directoryService';
import * as followService from '../api/services/followService';
import { OPEN_TO_BY_KEY, normalizeOpenTo } from '../data/openTo';
import { getCountryByCode } from '../data/countries';
import { imageSource } from '../utils/imageSource';
import { reportError } from '../utils/reportError';
import { trackEvent } from '../utils/analytics';
import { hapticSelection } from '../utils/haptics';
import { bottomTabInset, layoutForWidth } from '../theme/layout';
import { useTabBarScrollVisibility } from '../navigation/TabBarVisibilityContext';

// The directory Edge Function exposes no facet endpoint, so the city
// chips are the same static diaspora hubs the onboarding city step
// suggests. Free-text search covers every other city.
const CITY_CHIPS = ['Nairobi', 'Kampala', 'Juba', 'Cairo', 'Melbourne', 'Omaha'];

// Single-select chip row: "Everywhere" | one city | "Verified only".
// Tapping the selected chip clears back to Everywhere (design behavior).
const FILTER_CHIPS = [
  { key: 'all', label: 'Everywhere' },
  ...CITY_CHIPS.map((c) => ({ key: c, label: c })),
  { key: 'verified', label: 'Verified only' },
];

// ss-tag palette cycles blue → green → gold → red by tag index, same
// as the design's ssTag() helper.
const TAG_CYCLE = [
  ['ssBlueTint', 'ssBlueDark'],
  ['ssGreenTint', 'ssGreenDark'],
  ['ssGoldTint', 'ssGoldDark'],
  ['ssRedTint', 'ssRedDark'],
];

// "City, Country · profession" — one line per the mock. The country is
// the resolved NAME ("Kenya"), never the stored alpha-2 code, which is
// what the design's label means. Work falls back through job → school
// so the line still says something useful.
const cityLine = (person) => {
  const countryName = getCountryByCode(person?.countryCode || person?.country)?.name
    || person?.country
    || '';
  const place = [person?.city, countryName].filter(Boolean).join(', ');
  const work = person?.profession || person?.job || person?.school;
  return [place, work].filter(Boolean).join(' · ') || null;
};

// Registry-style card kicker: "NO. 04 — NAIROBI". The number is the
// person's position in the result list, not a stable id — it reads as
// a ledger line, exactly like the design.
const cardKicker = (index, person) => {
  const num = String(index + 1).padStart(2, '0');
  const city = (person?.city || '').toUpperCase();
  return city ? `NO. ${num} — ${city}` : `NO. ${num}`;
};

// One directory result — the design's numbered Blueprint frame: 82×100
// photo, ledger kicker, condensed name, cycling ss-tags, Follow+Profile.
function DirectoryPersonCard({ person, index, onOpen, onFollow, isFollowing, styles, colors }) {
  const nameAge = person.age ? `${person.name}, ${person.age}` : person.name;
  const line = cityLine(person);
  const tags = normalizeOpenTo(person.openTo)
    .slice(0, 3)
    .map((key) => ({ key, label: OPEN_TO_BY_KEY[key]?.label || key }));

  return (
    <Blueprint style={styles.personCard}>
      <TouchableOpacity
        style={styles.personPhotoWrap}
        onPress={() => onOpen(person)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Open ${person.name || 'profile'}`}
        testID={`person-card-${person.id}`}
      >
        <Image source={imageSource(person.images?.[0] || person.photos?.[0])} style={styles.personPhoto} />
      </TouchableOpacity>

      <View style={styles.personBody}>
        <Text style={styles.personKicker} numberOfLines={1}>{cardKicker(index, person)}</Text>

        <TouchableOpacity
          onPress={() => onOpen(person)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Open ${person.name || 'profile'}`}
        >
          <View style={styles.personNameRow}>
            <Text style={styles.personName} numberOfLines={1}>{nameAge || 'JuNubin member'}</Text>
            {person.verified ? (
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color={colors.accentDark}
                accessibilityLabel="Verified"
              />
            ) : null}
          </View>
          {line ? <Text style={styles.personCity} numberOfLines={1}>{line}</Text> : null}
        </TouchableOpacity>

        {tags.length > 0 ? (
          <View style={styles.personTags}>
            {tags.map((t, j) => {
              const [bg, fg] = TAG_CYCLE[j % TAG_CYCLE.length];
              return (
                <View key={t.key} style={[styles.personTag, { backgroundColor: colors[bg] }]}>
                  <Text style={[styles.personTagText, { color: colors[fg] }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.personActions}>
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followBtnFollowing]}
            onPress={() => onFollow(person)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={isFollowing ? `Unfollow ${person.name}` : `Follow ${person.name}`}
            testID={`person-follow-${person.id}`}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextFollowing]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => onOpen(person)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`View ${person.name}'s profile`}
          >
            <Text style={styles.profileBtnText}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Blueprint>
  );
}

// Plain loading placeholder — the same Blueprint geometry as a result
// card with muted blocks where the content will land.
function SkeletonCard({ styles }) {
  return (
    <Blueprint style={styles.personCard}>
      <View style={[styles.personPhotoWrap, styles.skeletonBlock]} />
      <View style={styles.personBody}>
        <View style={[styles.skeletonBlock, styles.skeletonKicker]} />
        <View style={[styles.skeletonBlock, styles.skeletonName]} />
        <View style={[styles.skeletonBlock, styles.skeletonLine]} />
        <View style={[styles.skeletonBlock, styles.skeletonBtn]} />
      </View>
    </Blueprint>
  );
}

const DirectoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const layout = useMemo(() => layoutForWidth(width), [width]);
  const styles = useMemo(() => getStyles(colors, insets, isDark, layout), [colors, insets, isDark, layout]);
  const tabBarScrollProps = useTabBarScrollVisibility();
  const { session } = useAuth();

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [followingIds, setFollowingIds] = useState(() => new Set());
  const cursorRef = useRef(null);

  const search = useCallback(async ({ append = false } = {}) => {
    if (!session) { setPeople([]); return; }
    if (append) setLoadingMore(true); else setLoading(true);
    setLoadError(false);
    try {
      const { people: results, nextCursor } = await directoryService.searchDirectory({
        query: query || undefined,
        city: filter !== 'all' && filter !== 'verified' ? filter : undefined,
        verifiedOnly: filter === 'verified' || undefined,
        cursor: append ? cursorRef.current : undefined,
        limit: 24,
      });
      cursorRef.current = nextCursor || null;
      setPeople((prev) => (append ? [...prev, ...(results || [])] : (results || [])));
    } catch (err) {
      reportError('DirectoryScreen.search', err, { query, filter });
      if (!append) setPeople([]);
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [session, query, filter]);

  useEffect(() => {
    cursorRef.current = null;
    search();
  }, [search]);

  // Debounce keystrokes into the committed query — the design searches
  // as you type, so there is no explicit submit step.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = queryInput.trim();
      setQuery((prev) => {
        if (prev !== q && q) trackEvent('directory_search');
        return q;
      });
    }, 350);
    return () => clearTimeout(t);
  }, [queryInput]);

  useEffect(() => {
    if (!session || people.length === 0) return;
    let cancelled = false;
    followService.checkFollowStatus(people.map((p) => p.id))
      .then((set) => { if (!cancelled) setFollowingIds(set); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session, people]);

  // Single-select: tapping the active chip clears back to Everywhere.
  const tapChip = useCallback((key) => {
    hapticSelection();
    setFilter((prev) => {
      const next = prev === key ? 'all' : key;
      trackEvent('directory_filters_applied', { count: next === 'all' ? 0 : 1 });
      return next;
    });
  }, []);

  const handleFollow = useCallback(async (person) => {
    if (!person?.id) return;
    const already = followingIds.has(person.id);
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (already) next.delete(person.id); else next.add(person.id);
      return next;
    });
    try {
      if (already) await followService.unfollowUser(person.id);
      else await followService.followUser(person.id);
      trackEvent(already ? 'unfollow' : 'follow', { surface: 'directory' });
    } catch (err) {
      reportError('DirectoryScreen.follow', err, { targetId: person.id });
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (already) next.add(person.id); else next.delete(person.id);
        return next;
      });
    }
  }, [followingIds]);

  const openProfile = useCallback((person) => {
    navigation?.navigate?.('ProfileDetail', {
      profile: { ...person, images: person.images || person.photos || [] },
    });
  }, [navigation]);

  // "8 PEOPLE IN THE DIASPORA DIRECTORY" / '3 PEOPLE MATCHING "JUBA"'.
  // The design counts the whole filtered set; the `directory` Edge
  // Function returns a cursor page and no total, so this counts what is
  // loaded. Exact while a single page covers the results (nextCursor
  // null) — it needs a `total` in the function response to be exact for
  // paginated result sets.
  const countLine = query
    ? `${people.length} PEOPLE MATCHING "${query.toUpperCase()}"`
    : `${people.length} PEOPLE IN THE DIASPORA DIRECTORY`;

  return (
    <View style={styles.screen}>
      {/* ─── HEADER: h1 + search + chips ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.headerTitle} accessibilityRole="header">Directory</Text>
        </View>

        <View style={styles.searchField}>
          <Ionicons name="search-outline" size={18} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={queryInput}
            onChangeText={setQueryInput}
            placeholder="Name, city, profession, school…"
            placeholderTextColor={colors.gray400}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search the directory"
            testID="directory-search"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {FILTER_CHIPS.map((chip) => {
            const selected = filter === chip.key;
            return (
              <TouchableOpacity
                key={chip.key}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => tapChip(chip.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={chip.label}
                testID={`directory-chip-${chip.key}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── RESULTS ─── */}
      <FlatList
        {...tabBarScrollProps}
        data={people}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <DirectoryPersonCard
            person={item}
            index={index}
            onOpen={openProfile}
            onFollow={handleFollow}
            isFollowing={followingIds.has(item.id)}
            styles={styles}
            colors={colors}
          />
        )}
        ListHeaderComponent={!loading ? (
          <Text style={styles.countLine} accessibilityRole="text">{countLine}</Text>
        ) : null}
        contentContainerStyle={people.length === 0 && !loading ? styles.emptyWrap : styles.listContent}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && !loadingMore && cursorRef.current) search({ append: true });
        }}
        refreshControl={(
          <ThemedRefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cursorRef.current = null; search(); }}
          />
        )}
        ListFooterComponent={loadingMore ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
        ) : null}
        ListEmptyComponent={loading ? (
          <View style={styles.skeletonList}>
            <SkeletonCard styles={styles} />
            <SkeletonCard styles={styles} />
            <SkeletonCard styles={styles} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons
              name={loadError ? 'cloud-offline-outline' : 'search-outline'}
              size={28}
              color={colors.gray400}
            />
            <Text style={styles.emptyTitle}>
              {loadError ? "Couldn't load the directory" : 'No one matched'}
            </Text>
            <Text style={styles.emptySub}>
              {loadError
                ? 'Check your connection and try again.'
                : 'Try a different city or clear a filter. The community is still growing.'}
            </Text>
            <View style={styles.emptyActions}>
              {loadError ? (
                <Button title="Try again" variant="primary" size="md" fullWidth onPress={() => search()} />
              ) : filter !== 'all' || query ? (
                <Button
                  title="Clear search and filters"
                  variant="primary"
                  size="md"
                  fullWidth
                  onPress={() => { setQueryInput(''); setQuery(''); setFilter('all'); }}
                />
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
};

const getStyles = (colors, insets, isDark, layout) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: layout.horizontal,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: colors.cream,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    ...layout.centeredContent,
  },

  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 31,
    lineHeight: 31,
    marginTop: 2,
    color: colors.black,
  },

  // ── Search box — 46px, hairline, muted surface, r4 ──
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    paddingHorizontal: 13,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: colors.black,
    padding: 0,
  },

  // ── Filter chips — single-select, 36px, r4 ──
  chipsScroll: {
    marginHorizontal: -layout.horizontal,
  },
  chipsRow: {
    paddingHorizontal: layout.horizontal,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.cream,
    borderRadius: 4,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: colors.black,
  },
  chipTextSelected: {
    color: colors.accentDark,
  },

  // ── Results ──
  countLine: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: colors.gray400,
    letterSpacing: 0.72,
    marginBottom: 14,
  },
  listContent: {
    paddingHorizontal: layout.horizontal,
    paddingTop: 14,
    paddingBottom: bottomTabInset(insets.bottom),
    gap: 14,
    ...layout.centeredList,
  },

  // ── Person card (Blueprint, cream bg, 14 padding) ──
  personCard: {
    flexDirection: 'row',
    gap: 13,
    padding: 14,
    backgroundColor: colors.cream,
  },
  personPhotoWrap: {
    width: 82,
    height: 100,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.surfaceMuted,
  },
  personPhoto: {
    width: '100%',
    height: '100%',
  },
  personBody: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  personKicker: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.gray400,
  },
  personNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  personName: {
    fontFamily: FontFamily.heading,
    fontSize: 19,
    color: colors.black,
    flexShrink: 1,
  },
  personCity: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: colors.gray500,
    marginTop: 2,
  },
  personTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  personTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 2,
  },
  personTagText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.44,
  },
  personActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  followBtn: {
    height: 34,
    minWidth: 82,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
    borderRadius: 4,
  },
  followBtnFollowing: {
    borderColor: colors.separator,
    backgroundColor: colors.cream,
  },
  followBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12.5,
    color: colors.accentDark,
  },
  followBtnTextFollowing: {
    color: colors.gray500,
  },
  profileBtn: {
    height: 34,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
    borderRadius: 4,
  },
  profileBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12.5,
    color: colors.black,
  },

  // ── Loading skeletons — plain muted blocks in the card geometry ──
  skeletonList: {
    paddingHorizontal: layout.horizontal,
    paddingTop: 14,
    gap: 14,
    ...layout.centeredList,
  },
  skeletonBlock: {
    backgroundColor: colors.surfaceMuted,
  },
  skeletonKicker: {
    width: 110,
    height: 10,
  },
  skeletonName: {
    width: 140,
    height: 19,
  },
  skeletonLine: {
    width: 180,
    height: 12,
  },
  skeletonBtn: {
    width: 82,
    height: 34,
    marginTop: 8,
  },

  // ── Empty / error ──
  emptyWrap: {
    flexGrow: 1,
    paddingHorizontal: layout.horizontal,
    paddingTop: 14,
    paddingBottom: bottomTabInset(insets.bottom),
    ...layout.centeredList,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    color: colors.black,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.gray500,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: 14,
    width: '100%',
  },
});

export default DirectoryScreen;
