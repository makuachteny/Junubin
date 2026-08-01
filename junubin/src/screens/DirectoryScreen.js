// DirectoryScreen — the searchable South Sudanese diaspora directory.
//
// Home answers "who is near me". The directory answers "who is anywhere
// I care about": search by name, city, country, background, language,
// profession, school, or what someone is open to.
//
// Every filter here is free. JuNubin has no paid tier, so nothing on
// this screen is locked, blurred or upsold.
//
// People appear in the directory only when `Profile.directoryVisible`
// is true and their account is active and unmoderated — the `directory`
// Edge Function enforces that server-side along with block filtering,
// so the client never has to be trusted with it.
//
// Visual language: Industry redesign — square Blueprint person cards,
// hairline borders, condensed display type. Tokens only, no hex.

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import Button from '../components/Button';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { useAuth } from '../auth';
import * as directoryService from '../api/services/directoryService';
import * as followService from '../api/services/followService';
import { POPULAR_TRIBE_KEYS } from '../data/tribes';
import { LANGUAGE_OPTIONS } from '../data/languages';
import { OPEN_TO_OPTIONS, OPEN_TO_BY_KEY, normalizeOpenTo } from '../data/openTo';
import { imageSource } from '../utils/imageSource';
import { reportError } from '../utils/reportError';
import { trackEvent } from '../utils/analytics';
import { hapticSelection } from '../utils/haptics';

// Chips are {value, label} because `openTo` persists KEYS, not labels
// (see data/openTo.js) — filtering on the label would match nothing.
// Languages persist as plain strings, so value === label there.
//
// The language chip row is trimmed to the most common values; the full
// list lives in data/languages.js and free-text search covers the tail.
const COMMON_LANGUAGES = new Set([
  'Juba Arabic', 'English', 'Dinka', 'Nuer', 'Bari',
  'Shilluk', 'Zande', 'Swahili', 'Arabic', 'Amharic',
]);

const LANGUAGE_CHIPS = LANGUAGE_OPTIONS
  .filter((l) => COMMON_LANGUAGES.has(typeof l === 'string' ? l : l.label))
  .map((l) => {
    const name = typeof l === 'string' ? l : l.label;
    return { value: name, label: name };
  });

const OPEN_TO_CHIPS = OPEN_TO_OPTIONS.map((o) => ({ value: o.key, label: o.label }));

const ETHNICITY_CHIPS = POPULAR_TRIBE_KEYS.map((t) => ({ value: t, label: t }));

const emptyFilters = {
  ethnicity: null,
  language: null,
  openTo: null,
  verifiedOnly: false,
};

const countActive = (f) =>
  (f.ethnicity ? 1 : 0) + (f.language ? 1 : 0) + (f.openTo ? 1 : 0) + (f.verifiedOnly ? 1 : 0);

// "City, Country · profession" — one line per the mock. Falls back
// through job → school so the line still says something useful.
const cityLine = (person) => {
  const place = [person?.city, person?.country || person?.countryCode].filter(Boolean).join(', ');
  const work = person?.profession || person?.job || person?.school;
  return [place, work].filter(Boolean).join(' · ') || null;
};

// One directory result — the mock's Blueprint person card: square
// 72×88 photo, condensed name, openTo tags, Follow + Profile actions.
function DirectoryPersonCard({ person, onOpen, onFollow, isFollowing, styles, colors }) {
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
            {tags.map((t) => (
              <View key={t.key} style={styles.personTag}>
                <Text style={styles.personTagText} numberOfLines={1}>{t.label}</Text>
              </View>
            ))}
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

const DirectoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, insets, isDark), [colors, insets, isDark]);
  const { session } = useAuth();

  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [followingIds, setFollowingIds] = useState(() => new Set());
  const cursorRef = useRef(null);

  const activeCount = countActive(filters);

  const search = useCallback(async ({ append = false } = {}) => {
    if (!session) { setPeople([]); return; }
    if (append) setLoadingMore(true); else setLoading(true);
    setLoadError(false);
    try {
      const { people: results, nextCursor } = await directoryService.searchDirectory({
        query: query || undefined,
        ethnicity: filters.ethnicity || undefined,
        languages: filters.language ? [filters.language] : undefined,
        openTo: filters.openTo ? [filters.openTo] : undefined,
        verifiedOnly: filters.verifiedOnly || undefined,
        cursor: append ? cursorRef.current : undefined,
        limit: 24,
      });
      cursorRef.current = nextCursor || null;
      setPeople((prev) => (append ? [...prev, ...(results || [])] : (results || [])));
    } catch (err) {
      reportError('DirectoryScreen.search', err, { query, filters });
      if (!append) setPeople([]);
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [session, query, filters]);

  useEffect(() => {
    cursorRef.current = null;
    search();
  }, [search]);

  useEffect(() => {
    if (!session || people.length === 0) return;
    let cancelled = false;
    followService.checkFollowStatus(people.map((p) => p.id))
      .then((set) => { if (!cancelled) setFollowingIds(set); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session, people]);

  const submitQuery = useCallback(() => {
    setQuery(queryInput.trim());
    if (queryInput.trim()) trackEvent('directory_search');
  }, [queryInput]);

  const openFilters = useCallback(() => {
    setDraftFilters(filters);
    setShowFilters(true);
  }, [filters]);

  const applyFilters = useCallback(() => {
    setFilters(draftFilters);
    setShowFilters(false);
    trackEvent('directory_filters_applied', { count: countActive(draftFilters) });
  }, [draftFilters]);

  const toggleDraft = useCallback((key, value) => {
    hapticSelection();
    setDraftFilters((prev) => ({
      ...prev,
      [key]: prev[key] === value ? null : value,
    }));
  }, []);

  // Quick chips in the header row toggle the SAME filter state the
  // sheet edits — one source of truth, two entry points.
  const toggleQuickFilter = useCallback((key, value) => {
    hapticSelection();
    setFilters((prev) => {
      if (key === 'verifiedOnly') return { ...prev, verifiedOnly: !prev.verifiedOnly };
      return { ...prev, [key]: prev[key] === value ? null : value };
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
    navigation?.navigate?.('ProfileView', {
      profile: { ...person, images: person.images || person.photos || [] },
    });
  }, [navigation]);

  const renderChipGroup = (title, key, chips) => (
    <View style={styles.filterGroup} key={key}>
      <Text style={styles.filterGroupTitle}>{title}</Text>
      <View style={styles.filterChips}>
        {chips.map((chip) => {
          const selected = draftFilters[key] === chip.value;
          return (
            <TouchableOpacity
              key={chip.value}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              onPress={() => toggleDraft(key, chip.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // "8 PEOPLE IN THE DIASPORA DIRECTORY" / "3 PEOPLE MATCHING "JUBA""
  const countLine = query
    ? `${people.length} PEOPLE MATCHING "${query.toUpperCase()}"`
    : `${people.length} PEOPLE IN THE DIASPORA DIRECTORY`;

  return (
    <View style={styles.screen}>
      {/* ─── HEADER ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Directory</Text>

        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={colors.gray500} />
          <TextInput
            style={styles.searchInput}
            value={queryInput}
            onChangeText={setQueryInput}
            onSubmitEditing={submitQuery}
            placeholder="Name, city, profession, school…"
            placeholderTextColor={colors.gray400}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search the directory"
            testID="directory-search"
          />
          {queryInput.length > 0 ? (
            <TouchableOpacity
              onPress={() => { setQueryInput(''); setQuery(''); }}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          <TouchableOpacity
            style={[styles.chip, activeCount > 0 && styles.chipSelected]}
            onPress={openFilters}
            accessibilityRole="button"
            accessibilityLabel={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
            testID="directory-filters"
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={activeCount > 0 ? colors.accentDark : colors.black}
            />
            <Text style={[styles.chipText, activeCount > 0 && styles.chipTextSelected]}>
              {activeCount > 0 ? `Filters · ${activeCount}` : 'Filters'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, filters.verifiedOnly && styles.chipSelected]}
            onPress={() => toggleQuickFilter('verifiedOnly')}
            accessibilityRole="button"
            accessibilityState={{ selected: filters.verifiedOnly }}
            accessibilityLabel="Verified only"
          >
            <Text style={[styles.chipText, filters.verifiedOnly && styles.chipTextSelected]}>
              Verified only
            </Text>
          </TouchableOpacity>

          {OPEN_TO_CHIPS.map((chip) => {
            const selected = filters.openTo === chip.value;
            return (
              <TouchableOpacity
                key={chip.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleQuickFilter('openTo', chip.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Open to ${chip.label}`}
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
        data={people}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <DirectoryPersonCard
            person={item}
            onOpen={openProfile}
            onFollow={handleFollow}
            isFollowing={followingIds.has(item.id)}
            styles={styles}
            colors={colors}
          />
        )}
        ListHeaderComponent={!loading && people.length > 0 ? (
          <Text style={styles.countLine} accessibilityRole="text">{countLine}</Text>
        ) : null}
        contentContainerStyle={people.length === 0 ? styles.emptyWrap : styles.listContent}
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
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyBadge}>
              <Ionicons
                name={loadError ? 'cloud-offline-outline' : 'search-outline'}
                size={30}
                color={colors.accent}
              />
            </View>
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
              ) : activeCount > 0 || query ? (
                <Button
                  title="Clear search and filters"
                  variant="primary"
                  size="md"
                  fullWidth
                  onPress={() => { setQueryInput(''); setQuery(''); setFilters(emptyFilters); }}
                />
              ) : null}
            </View>
          </View>
        )}
      />

      {/* ─── FILTER SHEET ─── */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowFilters(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setDraftFilters(emptyFilters)}>
              <Text style={styles.sheetReset}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {renderChipGroup('Background', 'ethnicity', ETHNICITY_CHIPS)}
            {renderChipGroup('Language', 'language', LANGUAGE_CHIPS)}
            {renderChipGroup('Open to', 'openTo', OPEN_TO_CHIPS)}

            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Verification</Text>
              <TouchableOpacity
                style={[styles.toggleRow, draftFilters.verifiedOnly && styles.toggleRowActive]}
                onPress={() => setDraftFilters((p) => ({ ...p, verifiedOnly: !p.verifiedOnly }))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draftFilters.verifiedOnly }}
              >
                <Ionicons
                  name={draftFilters.verifiedOnly ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={draftFilters.verifiedOnly ? colors.accent : colors.gray400}
                />
                <Text style={styles.toggleLabel}>Verified members only</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 12 }} />
          </ScrollView>

          <View style={[styles.sheetFooter, { paddingBottom: insets.bottom + 12 }]}>
            <Button title="Show results" variant="primary" size="md" fullWidth onPress={applyFilters} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (colors, insets, isDark) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: colors.cream,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    color: colors.black,
  },

  // ── Search box — 46px, hairline, muted surface, square-ish r4 ──
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: StyleSheet.hairlineWidth,
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

  // ── Quick filter chips ──
  chipsScroll: {
    marginHorizontal: -18,
  },
  chipsRow: {
    paddingHorizontal: 18,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
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
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: colors.gray400,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: insets.bottom + 24,
    gap: 14,
  },

  // ── Person card (Blueprint) ──
  personCard: {
    flexDirection: 'row',
    gap: 13,
    padding: 14,
    backgroundColor: colors.cream,
  },
  personPhotoWrap: {
    width: 72,
    height: 88,
    borderWidth: StyleSheet.hairlineWidth,
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
    color: colors.gray600,
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
    backgroundColor: colors.accentTint15,
    borderRadius: 2,
  },
  personTagText: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.accentDark,
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
    backgroundColor: 'transparent',
  },
  followBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12.5,
    color: colors.accentDark,
  },
  followBtnTextFollowing: {
    color: colors.gray600,
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

  // ── Empty / error ──
  emptyWrap: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyBadge: {
    width: 60,
    height: 60,
    backgroundColor: colors.accentTint08,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    ...Typography.h3,
    fontFamily: FontFamily.heading,
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
  },

  // ── Filter sheet ──
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    backgroundColor: colors.cream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingTop: 8,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    color: colors.black,
  },
  sheetReset: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: colors.accent,
  },
  sheetBody: {
    paddingHorizontal: 20,
  },
  sheetFooter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  filterGroup: {
    marginTop: 14,
  },
  filterGroupTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: colors.gray600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
  },
  filterChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  filterChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: colors.black,
  },
  filterChipTextActive: {
    color: colors.accentDark,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
  },
  toggleRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint08,
  },
  toggleLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: colors.black,
  },
});

export default DirectoryScreen;
