import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Dimensions, Linking, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, FontFamily, Typography } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { POST_THEMES } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { SpraySplatter } from './GraffitiAccents';
import { useFollow } from '../hooks/useFollow';
import { GraffitiHeart, GraffitiChat, GraffitiBookmark, GraffitiRepost, GraffitiShare } from './icons';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 32;

const PostCard = ({ post, reactionState, onLikeToggle }) => {
  const fallbackReaction = useMemo(() => ({ liked: false, likeCount: post.likes }), [post.likes]);
  const [localReaction, setLocalReaction] = useState(fallbackReaction);
  const effectiveReaction = reactionState || localReaction;
  const { isFollowing: following, isFriend, toggleFollow } = useFollow(post.user?.id);
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();
  const [bookmarked, setBookmarked] = useState(false);

  const theme = POST_THEMES[post.cardTheme] || POST_THEMES.default;
  const isDarkCard = theme.bg === '#262626' || theme.bg === '#0C4A6E' || theme.bg === '#14532D' || theme.bg === '#7C2D12'
    || theme.bg === '#0E4D64' || theme.bg === '#1A5276' || theme.bg === '#1B4332';
  const subtleColor = isDarkCard ? 'rgba(255,255,255,0.55)' : colors.gray500;
  const boldColor = isDarkCard ? 'rgba(255,255,255,0.8)' : colors.black;

  const handleLike = () => {
    if (onLikeToggle) { onLikeToggle(post.id); return; }
    setLocalReaction((prev) => ({
      liked: !prev.liked,
      likeCount: !prev.liked ? prev.likeCount + 1 : Math.max(prev.likeCount - 1, 0),
    }));
  };

  const handleComment = () => navigation.navigate('PostDetail', { post });
  const handlePostPress = () => navigation.navigate('PostDetail', { post });
  const handleFollow = () => toggleFollow();
  const handleBookmark = () => setBookmarked(!bookmarked);

  const handleShare = () => {
    const postUrl = `https://haboba.app/post/${post.id}`;
    Alert.alert(
      'Share Post',
      null,
      [
        {
          text: 'Copy Link',
          onPress: () => Alert.alert('Copied!', 'Post link copied to clipboard.'),
        },
        {
          text: 'Send to Friend',
          onPress: () => {
            try {
              navigation.navigate('Main', { screen: 'MessagesTab', params: { sharePost: post } });
            } catch {
              Alert.alert('Share', 'Open Messages to send this post to a friend.');
            }
          },
        },
        {
          text: 'Share via...',
          onPress: () => {
            Share.share({
              message: `${post.content ? post.content.slice(0, 120) + '...' : 'Check out this post!'}\n\n${postUrl}`,
              url: Platform.OS === 'ios' ? postUrl : undefined,
              title: `${post.user.name}'s post on Haboba`,
            });
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignupLink = () => {
    if (!post.signupLink) return;
    Alert.alert(
      post.signupTitle || 'Sign Up',
      'You will be taken to an external page to register for this event.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Up Now',
          onPress: () => Linking.openURL(post.signupLink).catch(() => Alert.alert('Error', 'Could not open link.')),
        },
        {
          text: 'Share Event',
          onPress: () => {
            Share.share({
              message: `${post.signupTitle || 'Check out this event!'}\n\nSign up here: ${post.signupLink}`,
              title: post.signupTitle || 'Event',
            });
          },
        },
      ]
    );
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

  const hasImage = Boolean(post.image);
  const hasSignupLink = Boolean(post.signupLink);

  return (
    <View style={[styles.card, { backgroundColor: theme.bg, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
      {/* Ambient spray */}
      <View style={styles.sprayTopRight} pointerEvents="none">
        <SpraySplatter size={28} color={theme.accent} opacity={0.06} />
      </View>

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} activeOpacity={0.7}>
          <View style={[styles.avatarRing, { borderColor: theme.accent }]}>
            <Image source={imageSource(post.user.avatar)} style={[styles.avatar, { backgroundColor: colors.gray200 }]} />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.userName, { color: theme.text }]}>{post.user.name}</Text>
              {post.user.verified && (
                <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={9} color="#FFF" />
            </View>
          )}
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-sharp" size={11} color={subtleColor} />
          <Text style={[styles.meta, { color: subtleColor }]}>{post.user.location}</Text>
          <Text style={[styles.metaDot, { color: subtleColor }]}>&middot;</Text>
          <Text style={[styles.meta, { color: subtleColor }]}>{post.timestamp}</Text>
        </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.followChip, {
            backgroundColor: following ? 'transparent' : theme.accent,
            borderColor: theme.accent,
            borderWidth: following ? 1.5 : 0,
          }]}
          activeOpacity={0.8}
          onPress={handleFollow}
        >
          {isFriend && <Ionicons name="people" size={11} color={theme.accent} style={{ marginRight: 2 }} />}
          <Text style={[styles.followText, { color: following ? theme.accent : (isDarkCard ? '#000' : '#FFF') }]}>
            {isFriend ? 'Friends' : following ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreBtn} onPress={handleMoreMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={17} color={subtleColor} />
        </TouchableOpacity>
      </View>

      {/* ─── Content ─── */}
      {post.content && (
        <TouchableOpacity activeOpacity={0.9} onPress={handlePostPress}>
          <Text style={[styles.postText, { color: theme.text }]} numberOfLines={6}>
            {post.content}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─── Image ─── */}
      {hasImage && (
        <TouchableOpacity activeOpacity={0.95} onPress={handlePostPress} style={styles.imageWrap}>
          <Image source={imageSource(post.image)} style={styles.postImage} />
        </TouchableOpacity>
      )}

      {/* ─── Event Sign Up Banner ─── */}
      {hasSignupLink && (
        <TouchableOpacity style={styles.signupBanner} onPress={handleSignupLink} activeOpacity={0.85}>
          <LinearGradient
            colors={isDarkCard ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'] : ['rgba(0,151,57,0.08)', 'rgba(0,151,57,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.signupGradient}
          >
            <View style={[styles.signupIconWrap, { backgroundColor: isDarkCard ? 'rgba(72,201,176,0.15)' : 'rgba(0,151,57,0.12)' }]}>
              <Ionicons name="ticket" size={18} color={isDarkCard ? '#48C9B0' : colors.green} />
            </View>
            <View style={styles.signupInfo}>
              <Text style={[styles.signupTitle, { color: theme.text }]} numberOfLines={1}>
                {post.signupTitle || 'Sign Up for This Event'}
              </Text>
              <Text style={[styles.signupUrl, { color: subtleColor }]} numberOfLines={1}>
                Tap to register &middot; {post.signupLink.replace(/^https?:\/\//, '').split('/')[0]}
              </Text>
            </View>
            <View style={[styles.signupArrow, { backgroundColor: isDarkCard ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <Ionicons name="arrow-forward" size={14} color={isDarkCard ? '#48C9B0' : colors.green} />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ─── Engagement Stats ─── */}
      <View style={styles.statsRow}>
        <View style={styles.statsLeft}>
          {effectiveReaction.likeCount > 0 && (
            <Text style={[styles.statText, { color: subtleColor }]}>
              {effectiveReaction.likeCount.toLocaleString()} {effectiveReaction.likeCount === 1 ? 'like' : 'likes'}
            </Text>
          )}
        </View>
        {post.comments > 0 && (
          <TouchableOpacity onPress={handleComment}>
            <Text style={[styles.statText, { color: subtleColor }]}>
              {post.comments} {post.comments === 1 ? 'comment' : 'comments'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Action Bar ─── */}
      <View style={[styles.actionBar, { borderTopColor: isDarkCard ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        {/* Like */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
          <GraffitiHeart
            size={19}
            color={effectiveReaction.liked ? colors.rose : boldColor}
            filled={effectiveReaction.liked}
          />
          <Text style={[styles.actionLabel, { color: effectiveReaction.liked ? colors.rose : subtleColor }]}>
            Like
          </Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleComment} activeOpacity={0.7}>
          <GraffitiChat size={19} color={boldColor} />
          <Text style={[styles.actionLabel, { color: subtleColor }]}>Comment</Text>
        </TouchableOpacity>

        {/* Repost */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => Alert.alert('Reposted!', 'This post has been shared to your feed.')}
          activeOpacity={0.7}
        >
          <GraffitiRepost size={19} color={boldColor} />
          <Text style={[styles.actionLabel, { color: subtleColor }]}>Repost</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
          <GraffitiShare size={19} color={boldColor} />
          <Text style={[styles.actionLabel, { color: subtleColor }]}>Share</Text>
        </TouchableOpacity>

        {/* Bookmark */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark} activeOpacity={0.7}>
          <GraffitiBookmark size={19} color={bookmarked ? colors.gold : boldColor} filled={bookmarked} />
          <Text style={[styles.actionLabel, { color: bookmarked ? colors.gold : subtleColor }]}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default React.memo(PostCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
  },
  sprayTopRight: {
    position: 'absolute',
    right: 10,
    top: 10,
    zIndex: 0,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8EC',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    ...Typography.bodySmallMedium,
    fontSize: 15,
  },
  verifiedBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#4DA6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  metaDot: {
    fontSize: 12,
    marginHorizontal: 1,
  },
  followChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 15,
  },
  followText: {
    ...Typography.captionBold,
    fontSize: 12,
  },
  moreBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // ─── Content ───
  postText: {
    ...Typography.bodySmall,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingTop: 7,
    paddingBottom: 9,
  },

  // ─── Image ───
  imageWrap: {
    marginHorizontal: 14,
    marginBottom: 9,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  postImage: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    resizeMode: 'cover',
  },

  // ─── Signup Banner ───
  signupBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  signupGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  signupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupInfo: {
    flex: 1,
  },
  signupTitle: {
    ...Typography.label,
    marginBottom: 2,
  },
  signupUrl: {
    ...Typography.caption,
    fontSize: 12,
  },
  signupArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Stats Row ───
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 5,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    ...Typography.caption,
    fontSize: 13,
  },

  // ─── Action Bar ───
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderTopWidth: 1,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
  },
});
