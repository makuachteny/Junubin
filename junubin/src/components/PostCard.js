import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Dimensions, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { GraffitiWave } from './icons';
import { useTheme, FontFamily } from '../theme';
import { useNavigation } from '@react-navigation/native';
import { imageSource } from '../utils/imageSource';
import { useFollow } from '../hooks/useFollow';
import { useCurrentUser } from '../hooks';
import { normalizeHttpUrl } from '../utils/links';
import { POST_THEMES, POST_THEME_CYCLE } from '../data/mockProfiles';
import { toggleLike, toggleRepost } from '../api/services/postService';


const { width: W } = Dimensions.get('window');
const CARD_INSET = 12; // horizontal margin around the card
const MEDIA_W = W - CARD_INSET * 2;

// Like, comment, and repost are server-backed via postService (PostLike,
// PostComment, PostRepost — migration 00017). Optimistic UI updates the
// state immediately and rolls back on error. Wave remains a local-only
// visual gesture (no semantic backend yet) — see comment on `waved`.
const POST_INTERACTIONS_ENABLED = true;

// Aspect-ratio bounds that match Instagram's clamps so a single
// extreme upload can't produce a wall-of-card or a sliver.
const MIN_RATIO = 0.5625; // 9:16, full portrait
const MAX_RATIO = 1.91;   // 1.91:1, full landscape
const FALLBACK_RATIO = 1; // square — what we render when no aspect info

// Cheap, deterministic string hash so a post without an explicit
// cardTheme still picks the same colour every render.
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

const formatCount = (n) => {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString();
};

// Instagram-style: media is rendered at the post's natural aspect
// ratio, clamped to portrait..landscape. We compute the height from
// the (clamped) ratio at module scope so layout is stable across
// renders even before any image has loaded.
const computeMediaHeight = (rawRatio) => {
  const ratio = rawRatio && Number.isFinite(rawRatio) ? rawRatio : FALLBACK_RATIO;
  const clamped = Math.min(Math.max(ratio, MIN_RATIO), MAX_RATIO);
  return MEDIA_W / clamped;
};

const PostCard = ({ post, reactionState, onLikeToggle, pressEnabled = true, onPress }) => {
  // `post.liked` / `post.reposted` are pre-hydrated by the feed screen via
  // postService.getLikedPostIds / getRepostedPostIds (batch lookup). When
  // PostCard is rendered outside a feed (e.g. PostDetailScreen), they
  // default to false and the user can still toggle — the next visit
  // re-hydrates from the server.
  const fallbackReaction = useMemo(
    () => ({ liked: !!post.liked, likeCount: post.likes || 0 }),
    [post.liked, post.likes],
  );
  const [localReaction, setLocalReaction] = useState(fallbackReaction);
  const reaction = reactionState || localReaction;
  const { isFollowing, isFriend, toggleFollow, loading: followLoading } = useFollow(post.user?.id);
  const { currentUser } = useCurrentUser();
  const isOwnPost = !!currentUser?.id && currentUser.id === post.user?.id;
  const { colors, isDark } = useTheme();
  const nav = useNavigation();
  const [expanded, setExpanded] = useState(false);
  // `waved` — local-only visual gesture. There is no Wave table; it's
  // an animated affordance that gives the viewer a "say hi" moment
  // without committing to a like/swipe. The legacy testID
  // `post-save-action` is kept for back-compat with existing tests.
  const [waved, setWaved] = useState(false);
  const [reposted, setReposted] = useState(!!post.reposted);
  const [repostCount, setRepostCount] = useState(post.repostCount ?? post.reposts ?? 0);

  // Video state. `videoPlaying` mirrors the Video component's status —
  // we drive it via the playback object's pause/play methods so a
  // tap-to-pause toggles the play overlay back on without us hand-
  // managing two sources of truth.
  const videoRef = useRef(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);

  const sub = colors.gray500;
  const txt = colors.black;

  // Optimistic toggle — flip local state immediately, fire the network
  // call, roll back on failure. The `onLikeToggle` prop short-circuits
  // this when the parent owns reaction state (CommunityScreen does this
  // so the same like state persists across feed re-renders).
  const handleLike = useCallback(() => {
    if (onLikeToggle) { onLikeToggle(post.id); return; }
    const before = localReaction;
    const nextLiked = !before.liked;
    setLocalReaction({
      liked: nextLiked,
      likeCount: Math.max(before.likeCount + (nextLiked ? 1 : -1), 0),
    });
    toggleLike(post.id).catch(() => setLocalReaction(before));
  }, [localReaction, onLikeToggle, post.id]);

  const goDetail = () => nav.navigate('PostDetail', { post });
  const handleCardPress = onPress || goDetail;
  const stop = (e) => e?.stopPropagation?.();

  const handleRepost = useCallback(() => {
    const wasReposted = reposted;
    const nextReposted = !wasReposted;
    setReposted(nextReposted);
    setRepostCount((prev) => Math.max(prev + (nextReposted ? 1 : -1), 0));
    toggleRepost(post.id).catch(() => {
      setReposted(wasReposted);
      setRepostCount((prev) => Math.max(prev + (wasReposted ? 1 : -1), 0));
    });
  }, [reposted, post.id]);

  const handleSignup = () => {
    if (!post.signupLink) return;
    const normalized = normalizeHttpUrl(post.signupLink);
    if (!normalized) {
      Alert.alert('Invalid Link', 'This event link is not valid.');
      return;
    }
    nav.navigate('WebView', { url: normalized, title: post.signupTitle || 'Event' });
  };

  // Resolve media kind. Server-side this is `mediaType` ('image'|'video'|null);
  // when absent (legacy posts pre-00018 or mock seed data) we infer from
  // the presence of `post.video` vs. `post.image`.
  const isVideo = post.mediaType === 'video' || !!post.video;
  const mediaUri = post.video || post.image || null;
  const hasMedia = !!mediaUri;
  const hasLink = Boolean(post.signupLink);
  const mediaHeight = useMemo(() => computeMediaHeight(post.aspectRatio), [post.aspectRatio]);

  // Hero treatment for text-only, link-less posts: render the content
  // on a coloured gradient panel. With media or a link the gradient is
  // dropped — a clean white/dark surface reads better behind a photo.
  const isHero = !hasMedia && !hasLink;
  const theme = useMemo(() => resolveTheme(post), [post]);
  const gradient = isDark ? theme.dark : theme.light;
  const onColorText = isDark ? theme.textDark : theme.text;
  const onColorMuted = isDark ? 'rgba(245,243,240,0.65)' : 'rgba(26,26,26,0.55)';

  const maxLines = isHero ? 8 : 3;
  const [isTruncated, setIsTruncated] = useState(false);
  const handleTextLayout = useCallback((e) => {
    if (expanded || !post.content) return;
    const lines = e.nativeEvent.lines || [];
    if (lines.length === 0) return;
    const visibleChars = lines.reduce((sum, l) => sum + (l.text?.length || 0), 0);
    setIsTruncated(visibleChars < post.content.length);
  }, [expanded, post.content]);

  const handleVideoPress = useCallback(async (e) => {
    stop(e);
    const v = videoRef.current;
    if (!v) return;
    if (videoPlaying) {
      await v.pauseAsync();
    } else {
      await v.playAsync();
    }
  }, [videoPlaying]);

  const handleVideoMuteToggle = useCallback((e) => {
    stop(e);
    setVideoMuted((m) => !m);
  }, []);

  const cardBg = colors.cardBg;
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

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
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={$.header}>
        <Image source={imageSource(post.user.avatar)} style={[$.avatar, { backgroundColor: colors.gray300 }]} />
        <View style={$.hInfo}>
          <View style={$.nameRow}>
            <Text style={[$.name, { color: txt }]} numberOfLines={1}>{post.user.name}</Text>
            {post.user.verified && <Ionicons name="checkmark-circle" size={13} color="#0A66C2" />}
          </View>
          {(post.user.location || post.timestamp) && (
            <Text style={[$.metaLine, { color: sub }]} numberOfLines={1}>
              {[post.user.location, post.timestamp].filter(Boolean).join(' · ')}
            </Text>
          )}
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

      {/* ── Media (image or video) ─────────────────────────────────── */}
      {hasMedia && !isVideo && (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={(e) => { stop(e); handleCardPress(); }}
        >
          <Image
            source={imageSource(mediaUri)}
            style={[$.media, { height: mediaHeight, backgroundColor: colors.gray100 }]}
            resizeMode="cover"
          />
        </TouchableOpacity>
      )}
      {hasMedia && isVideo && (
        <Pressable
          style={[$.videoWrap, { height: mediaHeight, backgroundColor: '#000' }]}
          onPress={handleVideoPress}
        >
          <Video
            ref={videoRef}
            source={{ uri: mediaUri }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isMuted={videoMuted}
            isLooping
            shouldPlay={false}
            onPlaybackStatusUpdate={(status) => {
              if (!status?.isLoaded) return;
              setVideoPlaying(!!status.isPlaying);
            }}
          />
          {!videoPlaying && (
            <View style={$.playOverlay} pointerEvents="none">
              <View style={$.playCircle}>
                <Ionicons name="play" size={28} color="#FFFFFF" />
              </View>
            </View>
          )}
          <TouchableOpacity
            style={$.muteBtn}
            onPress={handleVideoMuteToggle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={videoMuted ? 'volume-mute' : 'volume-high'} size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      )}

      {/* ── Hero gradient panel for text-only posts ────────────────── */}
      {(post.content || hasLink) && isHero && (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[$.panel, $.panelHero]}
        >
          {post.content && (
            <View>
              <Text
                style={[$.heroText, { color: onColorText }]}
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
            <TouchableOpacity
              onPress={(e) => { stop(e); handleSignup(); }}
              style={[$.linkRow, { marginTop: post.content ? 14 : 0 }]}
              activeOpacity={0.7}
            >
              <Ionicons name="link-outline" size={13} color={colors.accent} />
              <Text style={[$.linkText, { color: colors.accent }]} numberOfLines={1}>
                {post.signupTitle || post.signupLink.replace(/^https?:\/\//, '').split('/')[0]}
              </Text>
              <Ionicons name="chevron-forward" size={11} color={colors.accent} />
            </TouchableOpacity>
          )}
        </LinearGradient>
      )}

      {/* ── Actions row (Instagram-style line icons) ───────────────── */}
      {POST_INTERACTIONS_ENABLED && (
        <View style={$.actions}>
          <View style={$.actLeft}>
            <TouchableOpacity
              testID="post-like-action"
              onPress={(e) => { stop(e); handleLike(); }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={$.iconBtn}
            >
              <Ionicons
                name={reaction.liked ? 'heart' : 'heart-outline'}
                size={26}
                color={reaction.liked ? '#FF3040' : txt}
              />
            </TouchableOpacity>
            <TouchableOpacity
              testID="post-comment-action"
              onPress={(e) => { stop(e); handleCardPress(); }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={$.iconBtn}
            >
              <Ionicons name="chatbubble-outline" size={24} color={txt} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="post-repost-action"
              onPress={(e) => { stop(e); handleRepost(); }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={$.iconBtn}
            >
              <Ionicons
                name={reposted ? 'repeat' : 'repeat-outline'}
                size={26}
                color={reposted ? '#009739' : txt}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="post-save-action"
            accessibilityRole="button"
            accessibilityLabel={waved ? `Unwave ${post.user?.name || ''}`.trim() : `Wave at ${post.user?.name || ''}`.trim()}
            onPress={(e) => { stop(e); setWaved((p) => !p); }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={$.iconBtn}
          >
            <GraffitiWave
              size={24}
              color={waved ? colors.accent : txt}
              filled={waved}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Likes count ────────────────────────────────────────────── */}
      {reaction.likeCount > 0 && (
        <View style={$.countRow}>
          <Text testID="post-like-count" style={[$.likesText, { color: txt }]}>
            {formatCount(reaction.likeCount)} {reaction.likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </View>
      )}

      {/* ── Caption (for media posts — text-only posts already showed
              their content in the hero panel above) ────────────────── */}
      {!isHero && post.content ? (
        <View style={$.captionWrap}>
          <Text
            style={[$.caption, { color: txt }]}
            numberOfLines={expanded ? undefined : maxLines}
            onTextLayout={handleTextLayout}
          >
            <Text style={$.captionName}>{post.user.name}</Text>
            {'  '}
            {post.content}
          </Text>
          {!expanded && isTruncated && (
            <TouchableOpacity
              onPress={(e) => { stop(e); setExpanded(true); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Show more"
            >
              <Text style={[$.more, { color: sub }]}>more</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* ── Signup link card for non-hero posts ────────────────────── */}
      {!isHero && hasLink && (
        <TouchableOpacity
          onPress={(e) => { stop(e); handleSignup(); }}
          style={[$.signupCard, { borderColor }]}
          activeOpacity={0.7}
        >
          <Ionicons name="link-outline" size={14} color={colors.accent} />
          <Text style={[$.signupText, { color: colors.accent }]} numberOfLines={1}>
            {post.signupTitle || post.signupLink.replace(/^https?:\/\//, '').split('/')[0]}
          </Text>
          <Ionicons name="chevron-forward" size={12} color={colors.accent} />
        </TouchableOpacity>
      )}

      {/* ── Comments link ──────────────────────────────────────────── */}
      {(post.comments || 0) > 0 && (
        <TouchableOpacity
          onPress={(e) => { stop(e); handleCardPress(); }}
          hitSlop={{ top: 4, bottom: 4, left: 6, right: 6 }}
          style={$.viewCommentsRow}
        >
          <Text style={[$.viewCommentsText, { color: sub }]}>
            View all {formatCount(post.comments)} {post.comments === 1 ? 'comment' : 'comments'}
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Reposts count (separate line — gives signal without
              cluttering the icon row) ──────────────────────────────── */}
      {repostCount > 0 && (
        <Text style={[$.repostText, { color: sub }]}>
          {formatCount(repostCount)} {repostCount === 1 ? 'repost' : 'reposts'}
        </Text>
      )}
    </Pressable>
  );
};

export default React.memo(PostCard);

const $ = StyleSheet.create({
  card: {
    marginHorizontal: CARD_INSET,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  // Header — slim Instagram-style row with a 32px avatar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  hInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    letterSpacing: -0.1,
  },
  metaLine: {
    fontSize: 11.5,
    fontFamily: FontFamily.regular,
    marginTop: 1,
    letterSpacing: 0.05,
  },
  moreBtn: { padding: 4 },

  // Media — full-bleed across the card, rendered at the post's
  // natural aspect ratio. Background colour shows briefly while the
  // image loads so we don't get a blank flash.
  media: {
    width: '100%',
  },
  videoWrap: {
    width: '100%',
    overflow: 'hidden',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Hero panel for text-only posts — full-bleed gradient.
  panel: {
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  panelHero: {
    minHeight: 200,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  heroText: {
    fontSize: 24,
    lineHeight: 31,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  more: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    marginTop: 6,
    opacity: 0.75,
  },

  // Action row — line icons, no background pills (matches Instagram).
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  actLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBtn: {
    padding: 4,
  },

  // Likes / counts row — sits flush with the actions above.
  countRow: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 2,
  },
  likesText: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    letterSpacing: -0.1,
  },

  // Caption — Instagram puts the username inline before the body.
  captionWrap: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
  caption: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: FontFamily.regular,
  },
  captionName: {
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  // Inline link card for media posts (event signup links, etc.)
  signupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  signupText: {
    fontSize: 12.5,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    flex: 1,
  },
  // Inline link inside the gradient hero (text-only post variant)
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

  // "View all N comments"
  viewCommentsRow: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 2,
  },
  viewCommentsText: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },

  // Reposts count
  repostText: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 10,
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
});
