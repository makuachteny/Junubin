import React, { useState, useMemo, useRef, useEffect } from 'react';
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
import { mockNotifications, imageSource } from '../data/mockProfiles';

const ICON_MAP = {
  like: { name: 'heart', color: '#FF80AB' },
  match: { name: 'heart-circle', color: '#FF80AB' },
  comment: { name: 'chatbubble', color: '#6B8DB5' },
  follow: { name: 'person-add', color: '#6B9E5B' },
  like_post: { name: 'thumbs-up', color: '#E8453C' },
  group: { name: 'people', color: '#8B5CF6' },
  superlike: { name: 'star', color: '#FFC107' },
};

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [notifications, setNotifications] = useState(mockNotifications);
  const rowAnimsRef = useRef([]);
  const hasAnimatedRef = useRef(false);

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

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

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
            setNotifications((prev) =>
              prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
            );
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
          <Ionicons name="chevron-back" size={26} color={colors.black} />
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
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.gray400} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: 0.3,
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
    backgroundColor: colors.accentTint04,
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
