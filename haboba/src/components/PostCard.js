import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Dimensions, Share, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { imageSource } from '../utils/imageSource';
import { useFollow } from '../hooks/useFollow';
import { normalizeHttpUrl } from '../utils/links';

const { width: W } = Dimensions.get('window');

const PostCard = ({ post, reactionState, onLikeToggle }) => {
  const fallbackReaction = useMemo(() => ({ liked: false, likeCount: post.likes }), [post.likes]);
  const [localReaction, setLocalReaction] = useState(fallbackReaction);
  const reaction = reactionState || localReaction;
  const { isFollowing, isFriend, toggleFollow } = useFollow(post.user?.id);
  const { colors, isDark } = useTheme();
  const nav = useNavigation();
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  const sub = isDark ? colors.gray500 : colors.gray500;
  const txt = colors.black;

  const handleLike = () => {
    if (onLikeToggle) { onLikeToggle(post.id); return; }
    setLocalReaction((p) => ({ liked: !p.liked, likeCount: !p.liked ? p.likeCount + 1 : Math.max(p.likeCount - 1, 0) }));
  };
  const goDetail = () => nav.navigate('PostDetail', { post });
  const handleShare = () => {
    Share.share({ message: post.content ? post.content.slice(0, 120) : 'Check this out!', title: `${post.user.name}'s post` });
  };
  const handleSignup = () => {
    if (!post.signupLink) return;
    const normalized = normalizeHttpUrl(post.signupLink);
    if (!normalized) {
      Alert.alert('Invalid Link', 'This event link is not valid.');
      return;
    }
    nav.navigate('WebView', { url: normalized, title: post.signupTitle || 'Event' });
  };

  const hasImage = Boolean(post.image);
  const hasLink = Boolean(post.signupLink);
  const longText = post.content && post.content.length > 120;

  return (
    <Pressable style={[$.card, { backgroundColor: colors.white }]} onPress={goDetail}>

      {/* Header */}
      <View style={$.header}>
        <Image source={imageSource(post.user.avatar)} style={[$.avatar, { backgroundColor: colors.gray300 }]} />
        <View style={$.hInfo}>
          <View style={$.nameRow}>
            <Text style={[$.name, { color: txt }]} numberOfLines={1}>{post.user.name}</Text>
            {post.user.verified && <Ionicons name="checkmark-circle" size={14} color="#0A66C2" />}
          </View>
          <Text style={[$.subtitle, { color: sub }]} numberOfLines={1}>{post.user.location}</Text>
          <Text style={[$.time, { color: sub }]}>{post.timestamp}</Text>
        </View>
        {!isFollowing && !isFriend && (
          <TouchableOpacity onPress={toggleFollow} style={$.followBtn} activeOpacity={0.7}>
            <Text style={[$.followLabel, { color: colors.accent }]}>Follow</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => Alert.alert(post.user.name, null, [
          { text: 'Report', style: 'destructive' }, { text: 'Cancel', style: 'cancel' },
        ])} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-vertical" size={18} color={sub} />
        </TouchableOpacity>
      </View>

      {/* Text */}
      {post.content && (
        <View style={$.textWrap}>
          <Text style={[$.postText, { color: txt }]} numberOfLines={expanded ? undefined : 3}>
            {post.content}
          </Text>
          {!expanded && longText && (
            <TouchableOpacity onPress={() => setExpanded(true)}>
              <Text style={[$.more, { color: sub }]}>...more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Link */}
      {hasLink && (
        <TouchableOpacity onPress={handleSignup} style={$.linkRow} activeOpacity={0.7}>
          <Ionicons name="link-outline" size={14} color={colors.accent} />
          <Text style={[$.linkText, { color: colors.accent }]} numberOfLines={1}>
            {post.signupTitle || post.signupLink.replace(/^https?:\/\//, '').split('/')[0]}
          </Text>
        </TouchableOpacity>
      )}

      {/* Image */}
      {hasImage && (
        <TouchableOpacity activeOpacity={0.95} onPress={goDetail} style={$.imgWrap}>
          <Image source={imageSource(post.image)} style={$.img} />
        </TouchableOpacity>
      )}

      {/* Stats */}
      {(reaction.likeCount > 0 || post.comments > 0) && (
        <View style={[$.stats, { borderBottomColor: isDark ? colors.separator : 'rgba(0,0,0,0.08)' }]}>
          {reaction.likeCount > 0 && (
            <Text style={[$.statText, { color: sub }]}>
              {reaction.likeCount.toLocaleString()}
            </Text>
          )}
          <View style={{ flex: 1 }} />
          {post.comments > 0 && (
            <TouchableOpacity onPress={goDetail}>
              <Text style={[$.statText, { color: sub }]}>{post.comments} comments</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={$.actions}>
        <TouchableOpacity style={$.actBtn} onPress={handleLike}>
          <Ionicons name={reaction.liked ? 'heart' : 'heart-outline'} size={20} color={reaction.liked ? colors.accent : sub} />
          <Text style={[$.actLabel, { color: reaction.liked ? colors.accent : sub }]}>Like</Text>
        </TouchableOpacity>
        <TouchableOpacity style={$.actBtn} onPress={goDetail}>
          <Ionicons name="chatbubble-outline" size={18} color={sub} />
          <Text style={[$.actLabel, { color: sub }]}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={$.actBtn} onPress={() => setSaved(!saved)}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.accent : sub} />
          <Text style={[$.actLabel, { color: saved ? colors.accent : sub }]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={$.actBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={sub} />
          <Text style={[$.actLabel, { color: sub }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
};

export default React.memo(PostCard);

const $ = StyleSheet.create({
  card: {
    marginBottom: 6,
    borderRadius: 0,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  hInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 14, fontWeight: '600', fontFamily: FontFamily.semibold },
  subtitle: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 1 },
  time: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 1 },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  followLabel: { fontSize: 14, fontWeight: '600', fontFamily: FontFamily.semibold },

  // Text
  textWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  postText: { fontSize: 14, fontFamily: FontFamily.regular, lineHeight: 20 },
  more: { fontSize: 13, fontFamily: FontFamily.medium, marginTop: 2 },

  // Link
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 8 },
  linkText: { fontSize: 13, fontFamily: FontFamily.medium },

  // Image — inset with same padding as text
  imgWrap: { paddingHorizontal: 16 },
  img: { width: '100%', height: (W - 32) * 0.7, resizeMode: 'cover', borderRadius: 8 },

  // Stats
  stats: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statText: { fontSize: 12, fontFamily: FontFamily.regular },

  // Actions — LinkedIn style
  actions: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 4,
  },
  actBtn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, gap: 2 },
  actLabel: { fontSize: 12, fontFamily: FontFamily.medium },
});
