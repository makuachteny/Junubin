import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography, FontFamily } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { POST_THEMES } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { SpraySplatter } from './GraffitiAccents';
import { useFollow } from '../hooks/useFollow';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 32; // 16px margin each side

const PostCard = ({ post, reactionState, onLikeToggle }) => {
  const fallbackReaction = useMemo(() => ({ liked: false, likeCount: post.likes }), [post.likes]);
  const [localReaction, setLocalReaction] = useState(fallbackReaction);
  const effectiveReaction = reactionState || localReaction;
  const { isFollowing: following, isFriend, toggleFollow } = useFollow(post.user?.id);
  const { colors } = useTheme();
  const navigation = useNavigation();

  // Get the user-chosen card theme (or default)
  const theme = POST_THEMES[post.cardTheme] || POST_THEMES.default;
  const isDarkCard = theme.bg === '#262626' || theme.bg === '#0C4A6E' || theme.bg === '#14532D' || theme.bg === '#7C2D12';

  const handleLike = () => {
    if (onLikeToggle) {
      onLikeToggle(post.id);
      return;
    }
    setLocalReaction((prev) => {
      const nextLiked = !prev.liked;
      return {
        liked: nextLiked,
        likeCount: nextLiked ? prev.likeCount + 1 : Math.max(prev.likeCount - 1, 0),
      };
    });
  };

  const handleComment = () => {
    navigation.navigate('PostDetail', { post });
  };

  const handleShare = () => {
    Alert.alert('Share', 'Post link copied to clipboard!');
  };

  const handleFollow = () => {
    toggleFollow();
  };

  const handlePostPress = () => {
    navigation.navigate('PostDetail', { post });
  };

  const handleMoreMenu = () => {
    Alert.alert(
      post.user.name,
      null,
      [
        { text: 'Report Post', onPress: () => Alert.alert('Reported', 'This post has been reported. We\'ll review it shortly.'), style: 'destructive' },
        { text: 'Block User', onPress: () => Alert.alert('Blocked', `${post.user.name} has been blocked.`), style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.bg, borderColor: colors.cardBorder }]}
      activeOpacity={0.9}
      onPress={handlePostPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <Image source={imageSource(post.user.avatar)} style={[styles.avatar, { backgroundColor: colors.gray200 }]} />
        <View style={styles.headerInfo}>
          <Text style={[styles.userName, { color: theme.text }]}>{post.user.name}</Text>
          <Text style={[styles.meta, { color: isDarkCard ? 'rgba(255,255,255,0.5)' : colors.gray400 }]}>
            {post.user.location} · {post.timestamp}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.followBtn,
            { backgroundColor: following ? 'transparent' : theme.accent, borderColor: theme.accent, borderWidth: following ? 1.5 : 0 },
          ]}
          activeOpacity={0.8}
          onPress={handleFollow}
        >
          {isFriend && <Ionicons name="people" size={12} color={theme.accent} style={{ marginRight: 3 }} />}
          <Text style={[styles.followText, { color: following ? theme.accent : (isDarkCard ? '#000' : '#FFF') }]}>
            {isFriend ? 'Friends' : following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moreBtn}
          activeOpacity={0.7}
          onPress={handleMoreMenu}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* Subtle spray accent */}
      <View style={{ position: 'absolute', right: 8, top: 8 }} pointerEvents="none">
        <SpraySplatter size={24} color="#009739" opacity={0.04} />
      </View>

      {/* Content */}
      {post.content && (
        <Text style={[styles.postText, { color: theme.text }]}>{post.content}</Text>
      )}

      {/* Image */}
      {post.image && (
        <Image source={imageSource(post.image)} style={styles.postImage} />
      )}

      {/* Actions */}
      <View style={[styles.actions, isDarkCard && { borderTopColor: 'rgba(255,255,255,0.1)' }, !isDarkCard && { borderTopColor: colors.separator }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} accessibilityRole="button" accessibilityLabel={effectiveReaction.liked ? 'Unlike post' : 'Like post'} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={effectiveReaction.liked ? 'heart' : 'heart-outline'}
            size={20}
            color={effectiveReaction.liked ? colors.rose : (isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400)}
          />
          <Text style={[styles.actionText, { color: effectiveReaction.liked ? colors.rose : (isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400) }]}>
            {effectiveReaction.likeCount}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleComment} accessibilityRole="button" accessibilityLabel="Comment on post" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chatbubble-outline" size={18} color={isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400} />
          <Text style={[styles.actionText, { color: isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400 }]}>
            {post.comments}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Reposted', 'This post has been shared to your feed!')} accessibilityRole="button" accessibilityLabel="Repost" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="repeat-outline" size={19} color={isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share post" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={18} color={isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(PostCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    marginRight: 10,
    backgroundColor: '#EFEFEF',
  },
  headerInfo: {
    flex: 1,
  },
  userName: {
    ...Typography.bodySmallMedium,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  meta: {
    ...Typography.caption,
    marginTop: 2,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  followText: {
    ...Typography.captionBold,
  },
  moreBtn: {
    marginLeft: 6,
    padding: 4,
  },
  postText: {
    ...Typography.bodySmall,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingBottom: 12,
    lineHeight: 22,
  },
  postImage: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    resizeMode: 'cover',
  },
  actions: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 22,
    borderTopWidth: 0.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  actionText: {
    ...Typography.bodySmallMedium,
  },
});
