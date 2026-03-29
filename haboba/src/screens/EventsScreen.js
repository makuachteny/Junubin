// AnaJunubin — Events Listing Screen
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { mockEvents } from '../data/mockEvents';
import { interactiveStore } from '../utils/interactiveStore';
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
  const [seasonMode, setSeasonMode] = useState('Festival');
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    interactiveStore.getEventRooms().then((saved) => {
      if (saved && typeof saved === 'object') setJoinedRooms(saved);
    });
    interactiveStore.getSeasonMode().then((mode) => {
      if (mode) setSeasonMode(mode);
    });
    // Simulate initial load
    const timer = setTimeout(() => {
      setEvents(mockEvents);
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setEvents(mockEvents);
      setRefreshing(false);
    }, 800);
  }, []);

  const handleJoinRoom = useCallback((eventId) => {
    setJoinedRooms((prev) => {
      const next = { ...prev, [eventId]: !prev[eventId] };
      interactiveStore.setEventRooms(next);
      return next;
    });
  }, []);

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
          <View style={[styles.categoryTag, { backgroundColor: catColor + '20' }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>{item.category}</Text>
          </View>
          <Text style={styles.eventTitle}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.gray} />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="people-outline" size={13} color={colors.gray} />
            <Text style={styles.metaText}>{item.attendees} attending</Text>
          </View>
          <TouchableOpacity
            style={[styles.roomBtn, joined && styles.roomBtnJoined]}
            activeOpacity={0.8}
            onPress={() => handleJoinRoom(item.id)}
          >
            <Text style={[styles.roomBtnText, joined && styles.roomBtnTextJoined]}>
              {joined ? 'Joined Match Room' : 'Join Match Room'}
            </Text>
          </TouchableOpacity>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')}>
          <Ionicons name="add-circle-outline" size={26} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <EventSkeleton />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={(
            <View style={styles.seasonCard}>
              <Ionicons name="sparkles" size={18} color={colors.accent} />
              <Text style={styles.seasonText}>Seasonal Mode: {seasonMode}</Text>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No events nearby"
              subtitle="Check back soon for upcoming events"
            />
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: { ...Typography.screenTitle, color: colors.black },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  seasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.greenTint15,
    backgroundColor: colors.greenTint08,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  seasonText: {
    ...Typography.captionBold,
    color: colors.black,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.separator,
    marginBottom: 12,
    gap: 14,
    ...getShadow('sm', isDark),
  },
  dateBadge: {
    width: 52,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateMonth: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold },
  dateDay: { fontSize: 22, fontWeight: '800', fontFamily: FontFamily.extrabold },
  eventInfo: { flex: 1, gap: 4 },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  categoryText: { fontSize: 10, fontWeight: '700', fontFamily: FontFamily.bold },
  eventTitle: { ...Typography.sectionLabel, color: colors.black },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...Typography.caption, color: colors.gray },
  roomBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.greenTint15,
    backgroundColor: colors.greenTint08,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  roomBtnJoined: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  roomBtnText: {
    ...Typography.caption,
    color: colors.accent,
    fontSize: 11,
  },
  roomBtnTextJoined: {
    color: '#FFF',
  },
});
