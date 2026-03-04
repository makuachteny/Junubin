import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import PostCard from '../components/PostCard';
import { mockPosts } from '../data/mockProfiles';

export default function GroupDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const group = route.params?.group || {};
  const [joined, setJoined] = useState(route.params?.isMember || false);
  const [pinned, setPinned] = useState(false);
  const [memberCount, setMemberCount] = useState(group.members || 0);

  // Use some mock posts for this group
  const groupPosts = mockPosts.slice(0, 2).map((p, i) => ({
    ...p,
    id: `group-post-${i}`,
    user: { ...p.user, location: group.name },
  }));

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
      Alert.alert('Joined!', `You joined "${group.name}"`);
    }
  };

  const handlePin = () => {
    setPinned(!pinned);
    Alert.alert(
      pinned ? 'Unpinned' : 'Pinned!',
      pinned ? `"${group.name}" removed from pinned groups` : `"${group.name}" pinned to top of your groups`
    );
  };

  const handleShare = () => {
    Alert.alert('Share Group', 'Group link copied to clipboard!');
  };

  const handleReport = () => {
    Alert.alert('Report Group', 'Thank you for your report. We will review this group.');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{group.name || 'Group'}</Text>
        <TouchableOpacity onPress={handlePin} style={styles.headerIcon}>
          <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={22} color={pinned ? colors.accent : '#FFFFFF'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {/* Group banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <Ionicons name="people" size={48} color={colors.accent} />
          </View>
          <Text style={styles.bannerName}>{group.name}</Text>
          <Text style={styles.bannerMembers}>{memberCount.toLocaleString()} members</Text>
          {group.description && (
            <Text style={styles.bannerDesc}>{group.description}</Text>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.joinBtn, joined && styles.joinedBtn]}
              onPress={handleJoin}
              activeOpacity={0.8}
            >
              <Ionicons name={joined ? 'checkmark' : 'add'} size={18} color={joined ? colors.accent : '#FFFFFF'} />
              <Text style={[styles.joinBtnText, joined && styles.joinedBtnText]}>
                {joined ? 'Joined' : 'Join'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionIcon} onPress={handlePin}>
              <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={20} color={pinned ? colors.accent : colors.black} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionIcon} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={colors.black} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionIcon} onPress={handleReport}>
              <Ionicons name="flag-outline" size={20} color={colors.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Group rules */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Rules</Text>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleNumber}>1</Text>
            <Text style={styles.ruleText}>Be respectful and kind to all members</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleNumber}>2</Text>
            <Text style={styles.ruleText}>No spam, self-promotion, or irrelevant content</Text>
          </View>
          <View style={styles.ruleRow}>
            <Text style={styles.ruleNumber}>3</Text>
            <Text style={styles.ruleText}>Keep discussions relevant to the group topic</Text>
          </View>
        </View>

        {/* Group posts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Posts</Text>
            {joined && (
              <TouchableOpacity
                onPress={() => navigation.navigate('CreatePost')}
                style={styles.newPostBtn}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.newPostBtnText}>Post</Text>
              </TouchableOpacity>
            )}
          </View>

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
            <View style={styles.joinPrompt}>
              <Ionicons name="lock-closed" size={28} color={colors.gray400} />
              <Text style={styles.joinPromptText}>Join this group to see all posts and participate</Text>
              <TouchableOpacity style={styles.joinPromptBtn} onPress={handleJoin}>
                <Text style={styles.joinPromptBtnText}>Join Group</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: 14,
    backgroundColor: '#332F2D',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.sectionLabel,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  headerIcon: {
    padding: 4,
  },
  body: {
    flex: 1,
  },
  banner: {
    alignItems: 'center',
    backgroundColor: '#332F2D',
    paddingHorizontal: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  bannerIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.accentTint15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: colors.accentTint25,
  },
  bannerName: {
    ...Typography.h2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  bannerMembers: {
    ...Typography.bodySmall,
    color: colors.accent,
    marginTop: 4,
  },
  bannerDesc: {
    ...Typography.bodySmall,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 24,
  },
  joinedBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  joinBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  joinedBtnText: {
    color: colors.accent,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
    marginBottom: 14,
  },
  newPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    marginBottom: 14,
  },
  newPostBtnText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  ruleNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.cream,
    textAlign: 'center',
    lineHeight: 24,
    ...Typography.captionBold,
    color: colors.accent,
    overflow: 'hidden',
  },
  ruleText: {
    ...Typography.bodySmall,
    color: colors.gray,
    flex: 1,
    lineHeight: 20,
  },
  joinPrompt: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  joinPromptText: {
    ...Typography.bodySmall,
    color: colors.gray400,
    textAlign: 'center',
  },
  joinPromptBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 6,
  },
  joinPromptBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
});
