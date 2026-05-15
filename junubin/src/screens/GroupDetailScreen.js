import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import PostCard from '../components/PostCard';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { GraffitiCommunity } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';
import { mockPosts } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';

const MOCK_MEMBERS = [
  { id: 'm1', name: 'Achol', role: 'Admin' },
  { id: 'm2', name: 'Deng', role: 'Moderator' },
  { id: 'm3', name: 'Nyandeng', role: 'Member' },
  { id: 'm4', name: 'Garang', role: 'Member' },
  { id: 'm5', name: 'Abuk', role: 'Member' },
];

export default function GroupDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const group = route.params?.group || {};
  const groupRules = useMemo(
    () => (Array.isArray(group.rules) ? group.rules.filter((r) => typeof r === 'string' && r.trim()) : []),
    [group.rules]
  );
  const isMembersOnly = group.privacy === 'members' || group.privacy === 'private';
  const [joined, setJoined] = useState(route.params?.isMember || false);
  // Sync membership flag when the route param changes (e.g. user
  // joined via the discover modal in another tab while this screen
  // was alive). useState alone would have captured the first-mount
  // value forever.
  useEffect(() => {
    setJoined(!!route.params?.isMember);
  }, [route.params?.isMember]);
  const [pinned, setPinned] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const [memberCount, setMemberCount] = useState(group.members || 0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState('posts');

  // Track the pull-to-refresh timeout in a ref so we can cancel it
  // on unmount — otherwise a fast back-swipe right after pulling to
  // refresh would trigger a setState on an unmounted component and
  // warn about a memory leak.
  const refreshTimerRef = useRef(null);
  useEffect(() => () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 800);
  }, []);

  // Group feed shows the first 3 demo posts when DEMO_DATA_ENABLED
  // is true — gives every group a representative preview before
  // real group-scoped posts ship in a later release.
  const groupPosts = DEMO_DATA_ENABLED
    ? mockPosts.slice(0, 3).map((p, i) => ({
        ...p,
        id: `${group.id || 'group'}-post-${i}`,
        user: { ...p.user, location: group.name },
      }))
    : [];

  const handleJoin = () => {
    if (joined) {
      Alert.alert('Leave Group', `Leave "${group.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            setJoined(false);
            setMemberCount((prev) => prev - 1);
          },
        },
      ]);
    } else {
      setJoined(true);
      setMemberCount((prev) => prev + 1);
      Alert.alert('Welcome!', `You joined "${group.name}"`);
    }
  };

  const handlePin = () => {
    setPinned(!pinned);
  };

  const handleReport = () => {
    Alert.alert('Report Group', 'Thank you for your report. We will review this group.');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{group.name || 'Group'}</Text>
          <Text style={styles.headerSub}>{memberCount.toLocaleString()} members</Text>
        </View>
        <TouchableOpacity onPress={handlePin} style={styles.headerAction}>
          <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={20} color={pinned ? colors.accent : colors.gray500} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Hero Banner */}
        <LinearGradient
          colors={isDark ? ['#1A1A1A', '#0C0C0E'] : ['#F8F8FA', '#FFFFFF']}
          style={styles.heroBanner}
        >
          <View style={styles.sprayAccent} pointerEvents="none">
            <SpraySplatter size={40} color={colors.accent} opacity={0.06} />
          </View>

          <View style={styles.heroIconWrap}>
            <LinearGradient
              colors={['#CE1126', '#009739']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIconGradient}
            >
              <GraffitiCommunity size={32} color="#FFFFFF" filled />
            </LinearGradient>
          </View>

          <Text style={styles.heroName}>{group.name}</Text>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroStatPill}>
              <Ionicons name="people" size={13} color={colors.accent} />
              <Text style={styles.heroStatText}>{memberCount.toLocaleString()} members</Text>
            </View>
            <View style={styles.heroStatPill}>
              <Ionicons name="chatbubbles" size={13} color={colors.royal} />
              <Text style={styles.heroStatText}>{groupPosts.length} posts today</Text>
            </View>
          </View>

          {group.description && (
            <Text style={styles.heroDesc}>{group.description}</Text>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.joinBtn, joined && styles.joinedBtn]}
              onPress={handleJoin}
              activeOpacity={0.8}
            >
              <Ionicons name={joined ? 'checkmark' : 'add'} size={18} color={joined ? colors.accent : '#FFFFFF'} />
              <Text style={[styles.joinBtnText, joined && styles.joinedBtnText]}>
                {joined ? 'Joined' : 'Join Group'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCircle} onPress={handleReport} activeOpacity={0.7}>
              <Ionicons name="flag-outline" size={18} color={colors.gray500} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Group Rules — prominent surface */}
        {groupRules.length > 0 && (
          <View style={styles.rulesBanner}>
            <TouchableOpacity
              style={styles.rulesBannerHeader}
              onPress={() => setRulesExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={styles.rulesBannerTitleWrap}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
                <Text style={styles.rulesBannerTitle}>Group rules</Text>
                <View style={styles.rulesCountBadge}>
                  <Text style={styles.rulesCountText}>
                    {groupRules.length} {groupRules.length === 1 ? 'rule' : 'rules'}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={rulesExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.gray500}
              />
            </TouchableOpacity>
            {rulesExpanded && (
              <View style={styles.rulesBannerList}>
                {groupRules.map((rule, i) => (
                  <View key={`rule-${i}`} style={styles.ruleRow}>
                    <View style={styles.ruleNum}>
                      <Text style={styles.ruleNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.ruleText}>{rule}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Section Tabs */}
        <View style={styles.sectionTabs}>
          {[
            { id: 'posts', label: 'Posts', icon: 'newspaper-outline' },
            { id: 'about', label: 'About', icon: 'information-circle-outline' },
            { id: 'members', label: 'Members', icon: 'people-outline' },
          ].map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                onPress={() => setActiveSection(tab.id)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon} size={16} color={isActive ? '#FFFFFF' : colors.gray500} />
                <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Posts Section */}
        {activeSection === 'posts' && (
          <View style={styles.section}>
            {joined && (
              <TouchableOpacity
                style={styles.newPostCard}
                onPress={() => navigation.navigate('CreatePost')}
                activeOpacity={0.8}
              >
                <View style={styles.newPostIcon}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </View>
                <Text style={styles.newPostText}>Write something to the group...</Text>
                <Ionicons name="image-outline" size={20} color={colors.gray400} />
              </TouchableOpacity>
            )}

            {groupPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                onPress={() => navigation.navigate('PostDetail', { post })}
                activeOpacity={0.9}
              >
                <PostCard post={post} />
              </TouchableOpacity>
            ))}

            {!joined && (
              <View style={styles.lockPrompt}>
                <View style={styles.lockIconWrap}>
                  <Ionicons name="lock-closed" size={24} color={colors.gray400} />
                </View>
                <Text style={styles.lockTitle}>
                  {isMembersOnly ? 'Members only' : 'Join to participate'}
                </Text>
                <Text style={styles.lockDesc}>
                  {isMembersOnly
                    ? 'Only members can post in this group. Join to start the conversation.'
                    : 'Become a member to see all posts and join the conversation'}
                </Text>
                <TouchableOpacity style={styles.lockBtn} onPress={handleJoin} activeOpacity={0.8}>
                  <Text style={styles.lockBtnText}>{isMembersOnly ? 'Join to post' : 'Join Group'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* About Section */}
        {activeSection === 'about' && (
          <View style={styles.section}>
            {group.description && (
              <View style={styles.aboutCard}>
                <Text style={styles.aboutLabel}>About</Text>
                <Text style={styles.aboutText}>{group.description}</Text>
              </View>
            )}

            {groupRules.length > 0 && (
              <View style={styles.aboutCard}>
                <Text style={styles.aboutLabel}>Group Rules</Text>
                {groupRules.map((rule, i) => (
                  <View key={`about-rule-${i}`} style={styles.ruleRow}>
                    <View style={styles.ruleNum}>
                      <Text style={styles.ruleNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.ruleText}>{rule}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.aboutCard}>
              <Text style={styles.aboutLabel}>Info</Text>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.gray500} />
                <Text style={styles.infoText}>Created March 2025</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="earth-outline" size={16} color={colors.gray500} />
                <Text style={styles.infoText}>{isMembersOnly ? 'Members-only group' : 'Public group'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={16} color={colors.gray500} />
                <Text style={styles.infoText}>{memberCount.toLocaleString()} members</Text>
              </View>
            </View>
          </View>
        )}

        {/* Members Section */}
        {activeSection === 'members' && (
          <View style={styles.section}>
            {MOCK_MEMBERS.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <View style={[styles.memberAvatar, { backgroundColor: isDark ? colors.gray200 : colors.cream }]}>
                  <Text style={styles.memberInitial}>{member.name[0]}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
                {member.role === 'Admin' && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>Admin</Text>
                  </View>
                )}
                {member.role === 'Moderator' && (
                  <View style={[styles.roleBadge, { backgroundColor: isDark ? 'rgba(0,71,171,0.2)' : 'rgba(0,71,171,0.1)' }]}>
                    <Text style={[styles.roleBadgeText, { color: colors.royal }]}>Mod</Text>
                  </View>
                )}
              </View>
            ))}
            <Text style={styles.memberCountHint}>
              + {Math.max(0, memberCount - MOCK_MEMBERS.length)} more members
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.gray200 : colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    marginTop: 1,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.gray200 : colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Hero ───
  heroBanner: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  sprayAccent: {
    position: 'absolute',
    right: 20,
    top: 20,
  },
  heroIconWrap: {
    marginBottom: 16,
    shadowColor: '#CE1126',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  heroIconGradient: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroName: {
    ...Typography.screenTitle,
    color: colors.black,
    textAlign: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  heroStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  heroStatText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: colors.gray600,
  },
  heroDesc: {
    ...Typography.bodySmall,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  joinedBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  joinBtnText: {
    ...Typography.label,
    fontSize: 15,
    color: '#FFFFFF',
  },
  joinedBtnText: {
    color: colors.accent,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Rules Banner ───
  rulesBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(206,17,38,0.08)' : 'rgba(206,17,38,0.04)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(206,17,38,0.2)' : 'rgba(206,17,38,0.12)',
    overflow: 'hidden',
  },
  rulesBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rulesBannerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rulesBannerTitle: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  rulesCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(206,17,38,0.18)' : 'rgba(206,17,38,0.1)',
    marginLeft: 4,
  },
  rulesCountText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
  },
  rulesBannerList: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 2,
  },

  // ─── Section Tabs ───
  sectionTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  sectionTabActive: {
    backgroundColor: colors.black,
  },
  sectionTabText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.gray500,
  },
  sectionTabTextActive: {
    color: '#FFFFFF',
  },

  // ─── Section Content ───
  section: {
    paddingTop: 4,
  },
  body: {
    flex: 1,
  },

  // ─── New Post Card ───
  newPostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    gap: 12,
  },
  newPostIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPostText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.medium,
    color: colors.gray400,
  },

  // ─── Lock Prompt ───
  lockPrompt: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 8,
  },
  lockIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  lockTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  lockDesc: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 20,
  },
  lockBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 22,
    marginTop: 8,
  },
  lockBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ─── About Section ───
  aboutCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
  },
  aboutLabel: {
    ...Typography.labelUpper,
    color: colors.gray500,
    marginBottom: 12,
  },
  aboutText: {
    ...Typography.bodySmall,
    fontSize: 15,
    color: colors.gray600,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  ruleNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(206,17,38,0.15)' : 'rgba(206,17,38,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleNumText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
  },
  ruleText: {
    flex: 1,
    ...Typography.caption,
    color: colors.gray600,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    ...Typography.caption,
    color: colors.gray600,
  },

  // ─── Members Section ───
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInitial: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...Typography.bodySmallMedium,
    fontSize: 15,
    color: colors.black,
  },
  memberRole: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(206,17,38,0.15)' : 'rgba(206,17,38,0.08)',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
  },
  memberCountHint: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    color: colors.gray400,
    paddingVertical: 20,
  },
});
