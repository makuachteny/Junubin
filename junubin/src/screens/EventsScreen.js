import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Typography, getShadow } from '../theme';
import { mockEvents, EVENT_CITIES, EVENT_CATEGORIES } from '../data/mockEvents';
import { interactiveStore } from '../utils/interactiveStore';
import { getEvents, enrichEvents } from '../utils/eventStore';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';
import SkeletonShimmer from '../components/SkeletonShimmer';

const CATEGORY_COLORS = {
  Social: '#0047AB',
  Dating: '#CE1126',
  Diaspora: '#0047AB',
  Cultural: '#F59E0B',
  Sports: '#CE1126',
  Arts: '#EC4899',
};

function EventSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12, gap: 14 }}>
          <SkeletonShimmer width={52} height={56} borderRadius={12} />
          <View style={{ flex: 1 }}>
            <SkeletonShimmer width={60} height={12} borderRadius={6} />
            <SkeletonShimmer width={180} height={16} borderRadius={8} style={{ marginTop: 6 }} />
            <SkeletonShimmer width={120} height={12} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function EventsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [joinedRooms, setJoinedRooms] = useState({});
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    interactiveStore.getEventRooms().then((saved) => {
      if (saved && typeof saved === 'object') setJoinedRooms(saved);
    });
    const timer = setTimeout(async () => {
      const created = await getEvents();
      const merged = [...created, ...mockEvents];
      const enriched = await enrichEvents(merged);
      setEvents(enriched);
      setIsLoading(false);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Re-fetch on focus so a freshly-created event from CreateEventScreen
  // shows up immediately when the user returns. Without this the list is
  // stuck on its initial mount snapshot until pull-to-refresh.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const created = await getEvents();
      if (cancelled) return;
      const merged = [...created, ...mockEvents];
      const enriched = await enrichEvents(merged);
      if (!cancelled) setEvents(enriched);
    })();
    return () => { cancelled = true; };
  }, []));

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      getEvents().then(async (created) => {
        const merged = [...created, ...mockEvents];
        const enriched = await enrichEvents(merged);
        setEvents(enriched);
        setRefreshing(false);
      });
    }, 300);
  }, []);

  const handleJoinRoom = useCallback((eventId) => {
    setJoinedRooms((prev) => {
      const next = { ...prev, [eventId]: !prev[eventId] };
      interactiveStore.setEventRooms(next);
      return next;
    });
  }, []);

  // Filtered events
  const filteredEvents = useMemo(() => {
    let result = events;
    if (selectedCity !== 'All') {
      result = result.filter((e) => e.city === selectedCity);
    }
    if (selectedCategory !== 'All') {
      result = result.filter((e) => e.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, selectedCity, selectedCategory, searchQuery]);

  const activeFilterCount = (selectedCity !== 'All' ? 1 : 0) + (selectedCategory !== 'All' ? 1 : 0);

  const renderEvent = ({ item }) => {
    const catColor = CATEGORY_COLORS[item.category] || colors.accent;
    const joined = !!joinedRooms[item.id];
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => navigation.navigate('EventDetail', { event: item })}
        activeOpacity={0.7}
      >
        <View style={[styles.dateBadge, { backgroundColor: catColor + '15' }]}>
          <Text style={[styles.dateMonth, { color: catColor }]}>
            {new Date(item.date).toLocaleDateString('en', { month: 'short' }).toUpperCase()}
          </Text>
          <Text style={[styles.dateDay, { color: catColor }]}>
            {new Date(item.date).getDate()}
          </Text>
        </View>
        <View style={styles.eventInfo}>
          <View style={styles.eventTagRow}>
            <View style={[styles.categoryTag, { backgroundColor: catColor + '20' }]}>
              <Text style={[styles.categoryText, { color: catColor }]}>{item.category}</Text>
            </View>
            {item.isFree && (
              <View style={[styles.freeTag, { backgroundColor: isDark ? 'rgba(0,151,57,0.15)' : 'rgba(0,151,57,0.1)' }]}>
                <Text style={styles.freeTagText}>Free</Text>
              </View>
            )}
          </View>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-sharp" size={12} color={colors.gray500} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people" size={12} color={colors.gray500} />
            <Text style={styles.metaText}>{item.attendees} attending</Text>
            <Text style={styles.metaDot}>&middot;</Text>
            <Ionicons name="time-outline" size={12} color={colors.gray500} />
            <Text style={styles.metaText}>{item.time}</Text>
          </View>
          <TouchableOpacity
            style={[styles.roomBtn, joined && styles.roomBtnJoined]}
            activeOpacity={0.8}
            onPress={() => handleJoinRoom(item.id)}
          >
            <Ionicons
              name={joined ? 'checkmark-circle' : 'add-circle-outline'}
              size={14}
              color={joined ? '#FFF' : colors.accent}
            />
            <Text style={[styles.roomBtnText, joined && styles.roomBtnTextJoined]}>
              {joined ? 'Joined' : 'RSVP'}
            </Text>
          </TouchableOpacity>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.headerIconBtn}>
            <Ionicons name="options-outline" size={20} color={colors.black} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')} style={styles.headerAdd}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          placeholderTextColor={colors.gray400}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter modal */}
      <Modal visible={showFilters} transparent animationType="fade" onRequestClose={() => setShowFilters(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filter Events</Text>

            <Text style={styles.modalLabel}>City</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalPillRow}>
              {EVENT_CITIES.map((city) => {
                const isActive = selectedCity === city;
                return (
                  <TouchableOpacity
                    key={city}
                    style={[styles.modalPill, isActive && styles.modalPillActive]}
                    onPress={() => setSelectedCity(city)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalPillText, isActive && styles.modalPillTextActive]}>{city}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>Category</Text>
            <View style={styles.modalPillWrap}>
              {EVENT_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.modalPill, isActive && styles.modalPillActive]}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalPillText, isActive && styles.modalPillTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              {activeFilterCount > 0 && (
                <TouchableOpacity style={styles.modalClear} onPress={() => { setSelectedCity('All'); setSelectedCategory('All'); }} activeOpacity={0.7}>
                  <Text style={styles.modalClearText}>Reset</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.modalDone} onPress={() => setShowFilters(false)} activeOpacity={0.8}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Event list */}
      {isLoading ? (
        <EventSkeleton />
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title={searchQuery ? 'No matching events' : 'No events in this area'}
              subtitle={searchQuery ? 'Try a different search term' : 'Try selecting a different city or category'}
              actionLabel="Clear Filters"
              onAction={() => { setSelectedCity('All'); setSelectedCategory('All'); setSearchQuery(''); }}
            />
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.gray200 : colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.sectionTitle,
    fontSize: 20,
    color: colors.black,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.gray200 : colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  headerAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...Typography.caption,
    fontSize: 14,
    color: colors.black,
    paddingVertical: 0,
  },

  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 8,
  },
  modalPillRow: {
    gap: 8,
    paddingBottom: 8,
  },
  modalPillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  modalPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.separator,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.white,
  },
  modalPillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  modalPillText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.7)' : colors.gray600,
  },
  modalPillTextActive: {
    color: isDark ? '#1A1A1A' : '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalClear: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClearText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray600,
  },
  modalDone: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: isDark ? '#1A1A1A' : '#FFFFFF',
  },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 4 },

  // Event Card
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.white,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    marginBottom: 10,
    gap: 12,
    ...getShadow('sm', isDark),
  },
  dateBadge: {
    width: 54,
    height: 58,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateMonth: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold },
  dateDay: { fontSize: 24, fontWeight: '800', fontFamily: FontFamily.extrabold },
  eventInfo: { flex: 1, gap: 3 },
  eventTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold },
  freeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freeTagText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.green,
  },
  eventTitle: {
    ...Typography.bodySmallMedium,
    fontSize: 15,
    color: colors.black,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.gray500,
  },
  metaDot: {
    fontSize: 12,
    color: colors.gray400,
    marginHorizontal: 2,
  },
  roomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  roomBtnJoined: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  roomBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
  },
  roomBtnTextJoined: {
    color: '#FFF',
  },
});
