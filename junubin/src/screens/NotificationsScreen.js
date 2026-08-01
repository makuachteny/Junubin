// JuNubin — Notifications.
//
// Flat activity feed per the redesign: back chevron + "Notifications"
// header, then rows of "<b>Name</b> did a thing" over a relative time,
// 44px square avatar, hairline dividers, unread rows tinted
// accentTint08. Tapping a row opens the actor's profile.
//
// There is no in-app notification feed service yet — delivery is
// push-only — so the list renders from an empty array and falls back
// to the empty state. When the feed lands, rows are expected shaped
// { id, actor: <profile>, actorName, text, timeAgo, unread }.

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import EmptyState from '../components/EmptyState';

// Feed placeholder until a notifications service exists. Kept empty —
// we never invent data the backend can't produce.
const NOTIFICATIONS = [];

export default function NotificationsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const openActor = useCallback((item) => {
    if (!item?.actor) return;
    navigation.navigate('ProfileDetail', { profile: item.actor });
  }, [navigation]);

  const renderNotification = useCallback(({ item }) => (
    <TouchableOpacity
      style={[styles.row, item.unread && styles.rowUnread]}
      onPress={() => openActor(item)}
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
  ), [styles, openActor]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
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
        data={NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            subtitle="Follows, message requests and accepts land here. Push notifications keep working in the meantime."
          />
        }
      />
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 6,
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
    borderWidth: StyleSheet.hairlineWidth,
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
});
