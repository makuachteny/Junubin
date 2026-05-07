import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GraffitiRepost, GraffitiHeart, GraffitiChat, GraffitiWave } from './icons';
import { useTheme, FontFamily } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { imageSource } from '../utils/imageSource';
import { useFollow } from '../hooks/useFollow';
import { useCurrentUser } from '../hooks';
import { normalizeHttpUrl } from '../utils/links';
import { POST_THEMES, POST_THEME_CYCLE } from '../data/mockProfiles';


const { width: W } = Dimensions.get('window');

// Cheap, deterministic string hash so a post without an explicit
// cardTheme still picks the same colour every render. djb2 — fine for
// small IDs and avoids importing a hashing lib.
const hashId = (id = '') => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const resolveTheme = (post) => {
  const explicit = post?.cardTheme && POST_THEMES[post.cardTheme];
  if (explicit) return POST_THEMES[post.cardTheme];
  const key = POST_THEME_CYCLE[hashId(post?.id || '') % POST_THEME_CYCLE.length];
  return POST_THEMES[key];
};

const PostCard = ({ post, reactionState, onLikeToggle, pressEnabled = true, onPress }) => {
  const fallbackReaction = useMemo(() => ({ liked: false, likeCount: post.likes }), [post.likes]);
  const [localReaction, setLocalReaction] = useState(fallbackReaction);
  const reaction = reactionState || localReaction;
  const { isFollowing, isFriend, toggleFollow, loading: followLoading } = useFollow(post.user?.id);
  const { currentUser } = useCurrentUser();
  const isOwnPost = !!currentUser?.id && currentUser.id === post.user?.id;
  const { colors, isDark } = useTheme();
  const nav = useNavigation();
  const [expanded, setExpanded] = useState(false);
  // `waved` (formerly `saved`) tracks whether the viewer has waved at
  // the post's author. The legacy testID `post-save-action` is kept
  // for back-compat with existing tests.
  const [waved, setWaved] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repostCount ?? post.reposts ?? 0);

  const theme = useMemo(() => resolveTheme(post), [post]);
  const gradient = isDark ? theme.dark : theme.light;
  const onColorText = isDark ? theme.textDark : theme.text;
  // Muted variant of onColorText for secondary copy on the colour panel.
  const onColorMuted = isDark ? 'rgba(245,243,240,0.65)' : 'rgba(26,26,26,0.55)';

  const sub = colors.gray500;
  const txt = colors.black;

  const handleLike = () => {
    if (onLikeToggle) { onLikeToggle(post.id); return; }
    setLocalReaction((p) => ({ liked: !p.liked, likeCount: !p.liked ? p.likeCount + 1 : Math.max(p.likeCount - 1, 0) }));
  };
  const goDetail = () => nav.navigate('PostDetail', { post });
  const handleCardPress = onPress || goDetail;
  const stop = (e) => e?.stopPropagation?.();
  const handleRepost = () => {
    setRepostCount((prev) => prev + 1);
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
  // Big, hero-style typography only when the colour panel is the
  // hero — i.e. text-only posts. With an image or link, drop to
  // body size so the media stays the focal point.
  const isHero = !hasImage && !hasLink;
  const maxLines = isHero ? 8 : 5;
  // `isTruncated` is set when the rendered text is actually clipped —
  // measured by `onTextLayout` (sum of visible chars < total length).
  // This means "Show more" only appears when there really is more to
  // show, not based on a character-count heuristic.
  const [isTruncated, setIsTruncated] = useState(false);
  const handleTextLayout = useCallback((e) => {
    if (expanded || !post.content) return;
    const lines = e.nativeEvent.lines || [];
    if (lines.length === 0) return;
    const visibleChars = lines.reduce((sum, l) => sum + (l.text?.length || 0), 0);
    setIsTruncated(visibleChars < post.content.length);
  }, [expanded, post.content]);

  const formatCount = (n) => {
    if (!n) return '';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return n.toLocaleString();
  };

  const cardBg = colors.cardBg;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,13,12,0.05)';

  return (
    <Pressable
      style={[
        $.card,
        {
          backgroundColor: cardBg,
          borderColor,
          shadowColor: isDark ? '#000' : '#0F0D0C',
        },
      ]}
      onPress={pressEnabled ? handleCardPress : undefined}
      android_ripple={{ color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
    >
      {/* Header */}
      <View style={$.header}>
        <Image source={imageSource(post.user.avatar)} style={[$.avatar, { backgroundColor: colors.gray300 }]} />
        <View style={$.hInfo}>
          <View style={$.nameRow}>
            <Text style={[$.name, { color: txt }]} numberOfLines={1}>{post.user.name}</Text>
            {post.user.verified && <Ionicons name="checkmark-circle" size={15} color="#0A66C2" />}
          </View>
          <Text style={[$.metaLine, { color: sub }]} numberOfLines={1}>
            {post.user.location}{post.user.location && post.timestamp ? ' · ' : ''}{post.timestamp}
          </Text>
        </View>
        <TouchableOpacity
          testID="post-more-action"
          onPress={(e) => {
            stop(e);
            const followAction = isOwnPost
              ? null
              : isFriend
              ? { text: 'Unfollow Friend', style: 'destructive', onPress: () => { if (!followLoading) toggleFollow(); } }
              : isFollowing
              ? { text: 'Unfollow', style: 'destructive', onPress: () => { if (!followLoading) toggleFollow(); } }
              : { text: `Follow ${post.user?.name || ''}`.trim(), onPress: () => { if (!followLoading) toggleFollow(); } };
            const buttons = [
              ...(followAction ? [followAction] : []),
              { text: 'Report', style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ];
            Alert.alert(post.user.name, null, buttons);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={$.moreBtn}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={sub} />
        </TouchableOpacity>
      </View>

      {/* Image — full-bleed across the card. The card has overflow:hidden
          so any rounded-corner clipping is handled by the outer card,
          not the image itself. Sits flush against the gradient panel
          below (no inner margin, no inner radius), so they merge into
          one continuous block. */}
      {hasImage && (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={(e) => { stop(e); handleCardPress(); }}
        >
          <Image source={imageSource(post.image)} style={$.img} />
        </TouchableOpacity>
      )}

      {/* Gradient panel — text + link sit on the soft pastel. Full-bleed
          inside the card (no horizontal margin) so it docks edge-to-edge
          with the image above. Hero treatment kicks in for text-only
          posts (no image, no link). */}
      {(post.content || hasLink) && (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[
            $.panel,
            isHero && $.panelHero,
            hasImage && $.panelWithImage,
          ]}
        >
          {post.content && (
            <View>
              <Text
                style={[
                  isHero ? $.heroText : $.bodyText,
                  { color: onColorText },
                ]}
                numberOfLines={expanded ? undefined : maxLines}
                onTextLayout={handleTextLayout}
              >
                {post.content}
              </Text>
              {!expanded && isTruncated && (
                <TouchableOpacity
                  onPress={(e) => { stop(e); setExpanded(true); }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Show more"
                >
                  <Text style={[$.more, { color: onColorMuted }]}>Show more</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {hasLink && (
            <>
              {post.content && (
                <View
                  style={[
                    $.linkDivider,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' },
                  ]}
                />
              )}
              <TouchableOpacity
                onPress={(e) => { stop(e); handleSignup(); }}
                style={$.linkRow}
                activeOpacity={0.7}
              >
                <Ionicons name="link-outline" size={13} color={colors.accent} />
                <Text style={[$.linkText, { color: colors.accent }]} numberOfLines={1}>
                  {post.signupTitle || post.signupLink.replace(/^https?:\/\//, '').split('/')[0]}
                </Text>
                <Ionicons name="chevron-forward" size={11} color={colors.accent} />
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>
      )}


      {/* Actions — Like / Comment / Repost rendered as soft pill chips
          on the left, Save on the right. */}
      <View style={$.actions}>
        <View style={$.actLeft}>
          <TouchableOpacity
            testID="post-like-action"
            style={[$.chip, { backgroundColor: reaction.liked ? (isDark ? 'rgba(240,76,85,0.18)' : 'rgba(206,17,38,0.10)') : chipBg }]}
            onPress={(e) => { stop(e); handleLike(); }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <GraffitiHeart
              size={18}
              color={reaction.liked ? colors.accent : txt}
              filled={reaction.liked}
            />
            {reaction.likeCount > 0 && (
              <Text testID="post-like-count" style={[$.chipCount, { color: reaction.liked ? colors.accent : txt }]}>
                {formatCount(reaction.likeCount)}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="post-comment-action"
            style={[$.chip, { backgroundColor: chipBg }]}
            onPress={(e) => { stop(e); handleCardPress(); }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <GraffitiChat size={18} color={txt} />
            {post.comments > 0 && (
              <Text style={[$.chipCount, { color: txt }]}>{formatCount(post.comments)}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="post-repost-action"
            style={[$.chip, { backgroundColor: chipBg }]}
            onPress={(e) => { stop(e); handleRepost(); }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <GraffitiRepost size={18} color={txt} />
            {repostCount > 0 && (
              <Text style={[$.chipCount, { color: txt }]}>{formatCount(repostCount)}</Text>
            )}
          </TouchableOpacity>
        </View>
        {/* Wave — sends a friendly hi to the author (friend match
            gesture). Reuses the post-save tap target / testID so
            existing call-sites and tests keep working. */}
        <TouchableOpacity
          testID="post-save-action"
          accessibilityRole="button"
          accessibilityLabel={waved ? `Unwave ${post.user?.name || ''}`.trim() : `Wave at ${post.user?.name || ''}`.trim()}
          style={[$.chip, $.chipSave, { backgroundColor: waved ? (isDark ? 'rgba(240,76,85,0.18)' : 'rgba(206,17,38,0.10)') : chipBg }]}
          onPress={(e) => {
            stop(e);
            setWaved((prev) => !prev);
          }}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <GraffitiWave
            size={18}
            color={waved ? colors.accent : txt}
            filled={waved}
          />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
};

export default React.memo(PostCard);

const $ = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  // Header — sits on the white card surface above the media
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 11,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  hInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 15, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: -0.2 },
  metaLine: { fontSize: 12.5, fontFamily: FontFamily.regular, marginTop: 1, letterSpacing: 0.05 },
  moreBtn: { padding: 4 },

  // Image — full-bleed across the card. No border radius (the outer
  // card's overflow:hidden handles any clipping at the card's rounded
  // corners). Sits directly under the header and flush with the
  // gradient panel below.
  img: {
    width: '100%',
    height: (W - 24) * 0.62,
    resizeMode: 'cover',
  },

  // Gradient panel — full-bleed inside the card. When an image sits
  // above it, the seam is flat-on-flat with no notch. When there's no
  // image, the gradient becomes a coloured hero band inside the card
  // (panelHero ramps up the padding + min height for text-only posts).
  panel: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  panelHero: {
    minHeight: 220,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  // When the image precedes it, give the text a touch more breathing
  // room above so it doesn't crowd the photo.
  panelWithImage: {
    paddingTop: 18,
  },
  heroText: {
    fontSize: 27,
    lineHeight: 33,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  bodyText: {
    fontSize: 15.5,
    lineHeight: 22,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  more: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    marginTop: 8,
    opacity: 0.75,
  },

  // Hairline divider between text and link inside the gradient panel.
  linkDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  // Link — sits inside the gradient panel; no margin/radius/background
  // of its own so the gradient runs straight through it.
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  linkText: {
    fontSize: 12.5,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    letterSpacing: 0.1,
    flex: 1,
  },


  // Actions — pill chips. Padded to match the header's 14px so the leading
  // chip aligns vertically with the avatar above it. Cards in the feed
  // read as a clean grid when this gutter is consistent top to bottom.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  actLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    minHeight: 34,
    minWidth: 44,
    justifyContent: 'center',
  },
  chipSave: {
    paddingHorizontal: 12,
  },
  chipCount: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
