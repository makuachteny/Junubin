// JuNubin — Notifications.
//
// Flat activity feed per the redesign: back chevron + "Notifications"
// header, then rows of "<b>Name</b> did a thing" over a relative time,
// 44px square avatar, hairline dividers, unread rows tinted
// accentTint08. Tapping a row opens the actor's profile.
//
// Feed is derived from existing server truth: unread conversations,
// pending message requests, and accepted outgoing requests.

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import EmptyState from '../components/EmptyState';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import { useRealtime } from '../api/hooks/useRealtime';
import * as notificationService from '../api/services/notificationService';
import { layoutForWidth } from '../theme/layout';

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const layout = useMemo(() => layoutForWidth(width), [width]);
  const styles = useMemo(() => getStyles(colors, isDark, layout), [colors, isDark, layout]);
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const { onInboxActivity } = useRealtime(currentUser?.id);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(() => {
    if (!session) {
      setItems([]);
      setLoading(false);
      return Promise.resolve();
    }
    return notificationService.getNotifications()
      .then(setItems)
      .catch((err) => {
        if (__DEV__) console.warn('Notifications fetch failed:', err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [session]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
      return undefined;
    }, [fetchNotifications]),
  );

  useEffect(() => {
    if (!session) return undefined;
    return onInboxActivity(() => {
      fetchNotifications();
    });
  }, [session, onInboxActivity, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications().finally(() => setRefreshing(false));
  }, [fetchNotifications]);

  const openNotification = useCallback((item) => {
    if (item?.type === 'message' && item.conversationId) {
      navigation.navigate('Chat', { conversationId: item.conversationId, peer: item.actor });
      return;
    }
    if (item?.type === 'message_request') {
      navigation.navigate('Main', { screen: 'MessagesTab', params: { segment: 'requests' } });
      return;
    }
    if (item?.type === 'message_request_accepted' && item.conversationId) {
      navigation.navigate('Chat', { conversationId: item.conversationId, peer: item.actor });
      return;
    }
    if (!item?.actor) return;
    navigation.navigate('ProfileDetail', { profile: item.actor });
  }, [navigation]);

  const renderNotification = useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.row, item.unread && styles.rowUnread]}
      onPress={() => openNotification(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.actorName} ${item.text} ${item.timeAgo || ''}`.trim()}
    >
      <Image source={imageSource(item.actor?.images?.[0])} style={styles.avatar} />
      <View style={styles.rowText}>
        <Text style={styles.line}>
          <Text style={styles.lineName}>{item.actorName}</Text> {item.text}
        </Text>
        {item.timeAgo ? <Text style={styles.time}>{item.timeAgo}</Text> : null}
      </View>
    </TouchableOpacity>
  ), [styles, openNotification]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Notifications</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : (
            <EmptyState
              icon="notifications-outline"
              title="Nothing yet"
              subtitle="Unread chats, message requests and accepts land here."
            />
          )
        }
      />
    </View>
  );
}

const getStyles = (colors, _isDark, layout) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Math.max(10, layout.horizontal - 8),
    paddingBottom: 6,
    ...layout.centeredContent,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: FontFamily.heading,
    color: colors.black,
  },
  listContent: {
    flexGrow: 1,
    ...layout.centeredContent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowUnread: {
    backgroundColor: colors.accentTint08,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: colors.gray300,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  line: {
    fontSize: 13.5,
    lineHeight: 19.5,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },
  lineName: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
  },
  time: {
    fontSize: 11.5,
    fontFamily: FontFamily.regular,
    color: colors.gray400,
    marginTop: 2,
  },
  loading: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
