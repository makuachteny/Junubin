// AnaJunubin — Followers / Following List Screen
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import * as followService from '../api/services/followService';
import { useFollow } from '../hooks/useFollow';
import EmptyState from '../components/EmptyState';
import UnderlineTabs from '../components/UnderlineTabs';

// Inline follow button for each list row
function FollowButton({ userId, colors }) {
  const { isFollowing, isFriend, toggleFollow, loading } = useFollow(userId);

  const label = isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow';
  const isFilled = !isFollowing && !isFriend;

  return (
    <TouchableOpacity
      style={[
        styles.followBtn,
        isFilled
          ? { backgroundColor: colors.accent }
          : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: isFriend ? '#CE1126' : colors.accent },
      ]}
      onPress={toggleFollow}
      disabled={loading}
      activeOpacity={0.8}
    >
      {isFriend && <Ionicons name="people" size={12} color="#CE1126" style={{ marginRight: 3 }} />}
      <Text
        style={[
          styles.followBtnText,
          { color: isFilled ? '#FFF' : (isFriend ? '#CE1126' : colors.accent) },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function FollowListScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => getStyles(colors), [colors]);

  const { userId, userName, initialTab = 'Followers' } = route.params || {};
  const TABS = ['Followers', 'Following', 'Friends'];
  const [activeTab, setActiveTab] = useState(initialTab);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      followService.getFollowers(userId).catch(() => []),
      followService.getFollowing(userId).catch(() => []),
      followService.getFriends(userId).catch(() => []),
    ]).then(([f, fg, fr]) => {
      setFollowers(f);
      setFollowing(fg);
      setFriends(fr);
      setLoading(false);
    });
  }, [userId]);

  const currentList = activeTab === 'Followers' ? followers : activeTab === 'Following' ? following : friends;

  const renderUser = useCallback(({ item }) => (
    <TouchableOpacity
      style={s.userRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('ProfileDetail', { profile: item })}
    >
      <Image source={imageSource(item.images?.[0])} style={s.avatar} />
      <View style={s.userInfo}>
        <View style={s.nameRow}>
          <Text style={s.userName}>{item.name || item.displayName || 'User'}</Text>
          {item.verified && <Ionicons name="checkmark-circle" size={14} color={colors.accent} />}
        </View>
        {item.city && <Text style={s.userCity}>{item.city}</Text>}
      </View>
      <FollowButton userId={item.id} colors={colors} />
    </TouchableOpacity>
  ), [s, colors, navigation]);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{userName || 'User'}</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Tabs */}
      <View style={s.tabWrap}>
        <UnderlineTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </View>

      {/* List */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <EmptyState
              icon={activeTab === 'Friends' ? 'people-outline' : 'person-outline'}
              title={`No ${activeTab.toLowerCase()} yet`}
              subtitle={
                activeTab === 'Friends'
                  ? 'When you and someone follow each other, you become friends!'
                  : activeTab === 'Followers'
                  ? 'People who follow this profile will appear here.'
                  : 'People this user follows will appear here.'
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
});

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8, height: 52,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18, fontWeight: '700', fontFamily: FontFamily.bold, color: colors.black,
  },
  tabWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingBottom: 40 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gray300, marginRight: 12,
  },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { fontSize: 15, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.black },
  userCity: { fontSize: 12, fontFamily: FontFamily.regular, color: colors.gray500, marginTop: 2 },
});
