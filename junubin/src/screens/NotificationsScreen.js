import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockNotifications } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';
import SkeletonShimmer from '../components/SkeletonShimmer';

// Persisted set of notification IDs the user has marked as read. Survives app
// restarts and refresh-pull until a real backend syncs read state.
const READ_KEY = '@junubin_notif_read';

const ICON_MAP = {
  like: { name: 'heart', color: '#CE1126' },
  match: { name: 'heart-circle', color: '#CE1126' },
  comment: { name: 'chatbubble', color: '#0047AB' },
  follow: { name: 'person-add', color: '#009739' },
  like_post: { name: 'thumbs-up', color: '#CE1126' },
  group: { name: 'people', color: '#0047AB' },
  superlike: { name: 'star', color: '#FCCD12' },
};

function NotificationSkeleton() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 }}>
          <SkeletonShimmer width={50} height={50} borderRadius={25} />
          <View style={{ flex: 1 }}>
            <SkeletonShimmer width={160} height={14} borderRadius={7} />
            <SkeletonShimmer width={100} height={12} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const rowAnimsRef = useRef([]);
  const hasAnimatedRef = useRef(false);

  // Apply any persisted read-state so refresh / re-mount keeps the user's
  // "Mark all read" choice intact.
  const hydrateNotifications = useCallback(async () => {
    let readIds = new Set();
    try {
      const raw = await AsyncStorage.getItem(READ_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) readIds = new Set(parsed);
      }
    } catch {
      // ignore corrupt cache — defaults to no overrides
    }
    return mockNotifications.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const items = await hydrateNotifications();
      if (!cancelled) {
        setNotifications(items);
        setIsLoading(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [hydrateNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(async () => {
      const items = await hydrateNotifications();
      setNotifications(items);
      setRefreshing(false);
    }, 300);
  }, [hydrateNotifications]);

  // Add an id to the persisted read-set without overwriting other ids.
  const persistRead = useCallback(async (ids) => {
    try {
      const raw = await AsyncStorage.getItem(READ_KEY);
      const existing = raw ? new Set(JSON.parse(raw)) : new Set();
      ids.forEach((id) => existing.add(id));
      await AsyncStorage.setItem(READ_KEY, JSON.stringify([...existing]));
    } catch {
      // best-effort persistence — failure shouldn't block UI
    }
  }, []);

  useEffect(() => {
    if (hasAnimatedRef.current || notifications.length === 0) return;
    const anims = notifications.map(() => new Animated.Value(0));
    rowAnimsRef.current = anims;
    hasAnimatedRef.current = true;
    const staggered = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        delay: i * 45,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, staggered).start();
  }, [notifications]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const ids = prev.filter((n) => !n.read).map((n) => n.id);
      if (ids.length) persistRead(ids);
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, [persistRead]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item, index }) => {
    const iconConfig = ICON_MAP[item.type] || { name: 'notifications', color: colors.gray };
    const rowAnim = rowAnimsRef.current[index];
    const animStyle = rowAnim ? {
      opacity: rowAnim,
      transform: [{
        translateY: rowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      }],
    } : {};

    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={[styles.notifRow, !item.read && styles.notifUnread]}
          activeOpacity={0.7}
          onPress={() => {
            if (!item.read) persistRead([item.id]);
            setNotifications((prev) =>
              prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
            );
            // Route by type. We only deep-link when we have the FULL
            // payload (a `post` object, a real follower id, a `group`
            // object) so the destination doesn't render half-empty
            // and crash. Otherwise we drop the user on the closest
            // parent screen — better than a blank detail page.
            if (item.type === 'match' || item.type === 'like' || item.type === 'superlike') {
              navigation.navigate('Main', { screen: 'LikesTab' });
            } else if (item.type === 'comment' || item.type === 'like_post') {
              if (item.post && item.post.user) {
                navigation.navigate('PostDetail', { post: item.post });
              } else {
                navigation.navigate('Main', { screen: 'CommunityTab' });
              }
            } else if (item.type === 'follow') {
              if (item.userId) {
                // FollowList is the canonical "followers/following"
                // surface; pass userId so it loads that user's lists.
                navigation.navigate('FollowList', { userId: item.userId, userName: item.user, initialTab: 'Followers' });
              } else {
                navigation.navigate('Main', { screen: 'CommunityTab' });
              }
            } else if (item.type === 'group') {
              // GroupDetail expects the whole `group` object, not an id.
              if (item.group) {
                navigation.navigate('GroupDetail', { group: item.group });
              } else {
                navigation.navigate('Main', { screen: 'CommunityTab' });
              }
            }
          }}
        >
          <View style={styles.avatarWrap}>
            <Image source={imageSource(item.avatar)} style={styles.avatar} />
            <View style={[styles.iconBadge, { backgroundColor: iconConfig.color }]}>
              <Ionicons name={iconConfig.name} size={10} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.notifContent}>
            <Text style={styles.notifText}>
              <Text style={styles.notifUser}>{item.user}</Text>{' '}
              {item.text}
            </Text>
            <Text style={styles.notifTime}>{item.time}</Text>
          </View>

          {!item.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markRead}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {/* Notification list */}
      {isLoading ? (
        <NotificationSkeleton />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-outline"
              title="No notifications yet"
              subtitle="We'll let you know when something happens"
            />
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 0,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    textAlign: 'center',
  },
  markRead: {
    ...Typography.caption,
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  list: {
    paddingVertical: 4,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  notifUnread: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.gray300,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  notifContent: {
    flex: 1,
  },
  notifText: {
    ...Typography.bodySmall,
    color: colors.black,
    lineHeight: 20,
  },
  notifUser: {
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  notifTime: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    ...Typography.bodySmall,
    color: colors.gray400,
  },
});
