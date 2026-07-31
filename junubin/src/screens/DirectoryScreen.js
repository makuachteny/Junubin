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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, Layout } from '../theme';
import PersonCard from '../components/PersonCard';
import Button from '../components/Button';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { useAuth } from '../auth';
import * as directoryService from '../api/services/directoryService';
import * as followService from '../api/services/followService';
import { POPULAR_TRIBE_KEYS } from '../data/tribes';
import { LANGUAGE_OPTIONS } from '../data/languages';
import { OPEN_TO_OPTIONS } from '../data/openTo';
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

  return (
    <View style={styles.screen}>
      {/* ─── HEADER ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Directory</Text>
        </View>
        <Text style={styles.headerSub}>
          Find South Sudanese people by city, background, language or what they are open to.
        </Text>

        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons name="search" size={16} color={colors.gray500} />
            <TextInput
              style={styles.searchInput}
              value={queryInput}
              onChangeText={setQueryInput}
              onSubmitEditing={submitQuery}
              placeholder="Name, city, school or work"
              placeholderTextColor={colors.gray400}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search the directory"
              testID="directory-search"
            />
            {queryInput.length > 0 ? (
              <TouchableOpacity
                onPress={() => { setQueryInput(''); setQuery(''); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color={colors.gray400} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, activeCount > 0 && styles.filterBtnActive]}
            onPress={openFilters}
            accessibilityRole="button"
            accessibilityLabel="Filters"
            testID="directory-filters"
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeCount > 0 ? colors.white : colors.black}
            />
            {activeCount > 0 ? <Text style={styles.filterBtnCount}>{activeCount}</Text> : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── RESULTS ─── */}
      <FlatList
        data={people}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            onPress={openProfile}
            onFollow={handleFollow}
            isFollowing={followingIds.has(item.id)}
          />
        )}
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
            <View style={styles.emptyCircle}>
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
    backgroundColor: colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  headerTop: {
    height: Layout.headerHeight - 12,
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.tabTitle,
    color: colors.black,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: colors.black,
    padding: 0,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  filterBtnActive: {
    backgroundColor: colors.accent,
  },
  filterBtnCount: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: colors.white,
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyWrap: {
    flexGrow: 1,
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
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    ...Typography.h3,
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
    fontSize: 13,
    color: colors.gray700,
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.gray100,
  },
  filterChipActive: {
    backgroundColor: colors.accentTint15,
  },
  filterChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: colors.gray700,
  },
  filterChipTextActive: {
    color: colors.accent,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.gray100,
  },
  toggleRowActive: {
    backgroundColor: colors.accentTint08,
  },
  toggleLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: colors.black,
  },
});

export default DirectoryScreen;
