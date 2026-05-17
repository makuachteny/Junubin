import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, Dimensions, Pressable, Modal, TextInput, Animated } from 'react-native';
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
import { POST_THEMES, POST_THEME_CYCLE } from '../data/postThemes';
import { toggleLike, toggleRepost, toggleWave, deletePost, updatePostContent } from '../api/services/postService';


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

/**
 * Action icon + inline count. Renders a count even at 0 (greyed out)
 * so the affordance is always obvious — visible counters lift
 * engagement vs hiding the row until the first interaction. The icon
 * + count animate in lockstep on every transition (tap-up scale on
 * the icon, fade-pop on the number) to give the tap a satisfying
 * micro-reward without blocking the screen.
 */
const ActionButton = React.memo(function ActionButton({
  testID,
  countTestID,
  iconName,
  iconSize = 24,
  graffitiWave = false,
  waveFilled = false,
  color,
  mutedColor,
  count = 0,
  active = false,
  onPress,
  accessibilityLabel,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(count);

  // Pop the icon + count when the count changes (locally optimistic
  // or via realtime UPDATE). Skip the very first render so freshly-
  // mounted cards don't all wobble in.
  React.useEffect(() => {
    if (prevCountRef.current === count) return;
    prevCountRef.current = count;
    scale.setValue(0.7);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [count, scale]);

  const displayCount = count > 0 ? formatCount(count) : '0';
  const textColor = active || count > 0 ? color : mutedColor;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={actionStyles.btn}
    >
      <Animated.View style={[actionStyles.row, { transform: [{ scale }] }]}>
        {graffitiWave ? (
          <GraffitiWave size={iconSize} color={color} filled={waveFilled} />
        ) : (
          <Ionicons name={iconName} size={iconSize} color={color} />
        )}
        <Text
          testID={countTestID}
          style={[actionStyles.count, { color: textColor }]}
          numberOfLines={1}
        >
          {displayCount}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

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
  // The legacy testID `post-save-action` is kept for back-compat with
  // existing tests — it now targets the Wave button (a real server-
  // backed PostWave row per migration 00034).
  const [waved, setWaved] = useState(!!post.waved);
  const [waveCount, setWaveCount] = useState(post.waveCount ?? post.waves ?? 0);
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

  // Author-only edit state. Modal lets the author rewrite the text
  // body of their post (text-only by design — media + signupLink stay
  // pinned to the original publish so we don't have to re-run
  // moderation). Save is gated on a non-empty trim because empty
  // edits would silently wipe the caption; delete is the right path
  // for "remove this post".
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.content || '');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = useCallback(() => {
    setEditText(post.content || '');
    setEditOpen(true);
  }, [post.content]);

  const saveEdit = useCallback(async () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      Alert.alert('Empty text', 'Add some text or delete the post instead.');
      return;
    }
    if (trimmed === (post.content || '').trim()) {
      setEditOpen(false);
      return;
    }
    setSavingEdit(true);
    try {
      await updatePostContent(post.id, trimmed);
      setEditOpen(false);
      // The Community realtime UPDATE subscription patches the in-memory
      // post within the same tick, so we don't need to bubble the new
      // content up through props here.
    } catch (e) {
      Alert.alert("Couldn't save", e?.message || 'Try again in a moment.');
    } finally {
      setSavingEdit(false);
    }
  }, [editText, post.content, post.id]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete post?',
      'This will remove the post and all its likes, comments, and reposts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              // Realtime DELETE subscription in CommunityScreen removes
              // the card; no local state to clear here.
            } catch (e) {
              Alert.alert("Couldn't delete", e?.message || 'Try again in a moment.');
            }
          },
        },
      ],
    );
  }, [post.id]);

  const stop = (e) => e?.stopPropagation?.();

  // LinkedIn-style repost flow: tap shows a bottom action sheet
  // with two options.
  //   1. "Repost with your thoughts" → routes to the full
  //      CreatePostScreen with the original post attached as the
  //      quoted preview. Submit goes through the normal post path,
  //      writes both the new Post (with quotedPostId) AND the
  //      silent PostRepost row so the original's count + push fire.
  //   2. "Repost" → instant silent reshare. We just bump the
  //      original's PostRepost count via toggleRepost; no new Post
  //      is created. Match LinkedIn's "Repost" semantics (bring it
  //      to followers' feeds) — but with the simpler implementation
  //      of a count-only bump for v1.
  // If the user already reposted, the menu shows "Undo repost"
  // instead of "Repost" so they can take it back.
  const silentRepost = useCallback(() => {
    setReposted(true);
    setRepostCount((prev) => prev + 1);
    toggleRepost(post.id).catch((err) => {
      setReposted(false);
      setRepostCount((prev) => Math.max(prev - 1, 0));
      if (__DEV__) console.warn('repost failed:', err?.message || err);
    });
  }, [post.id]);

  const undoRepost = useCallback(() => {
    setReposted(false);
    setRepostCount((prev) => Math.max(prev - 1, 0));
    toggleRepost(post.id).catch((err) => {
      setReposted(true);
      setRepostCount((prev) => prev + 1);
      if (__DEV__) console.warn('undo repost failed:', err?.message || err);
    });
  }, [post.id]);

  const openRepostSheet = useCallback(() => {
    // Reposts touch real DB rows: PostRepost.postId is a FK back to
    // Post.id, and a quote-post's Post.quotedPostId is too. Demo /
    // mock cards (ids like `demo_post_001`) have no DB row, so both
    // paths would 23503 (FK violation). Short-circuit with a friendly
    // explainer instead.
    const idStr = String(post?.id || '');
    const isRealPost = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr)
      || idStr.startsWith('p_');
    if (!isRealPost) {
      Alert.alert(
        'Sample post',
        "Repost works on real community posts. This one's part of the demo set — try reposting a post that someone in the community shared.",
      );
      return;
    }
    Alert.alert(
      'Repost',
      'Choose how you want to share this post.',
      [
        {
          text: 'Repost with your thoughts',
          onPress: () => nav.navigate('CreatePost', { quotedPost: post }),
        },
        reposted
          ? { text: 'Undo repost', style: 'destructive', onPress: undoRepost }
          : { text: 'Repost', onPress: silentRepost },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [nav, post, reposted, silentRepost, undoRepost]);

  const handleWave = useCallback(() => {
    const wasWaved = waved;
    const nextWaved = !wasWaved;
    setWaved(nextWaved);
    setWaveCount((prev) => Math.max(prev + (nextWaved ? 1 : -1), 0));
    toggleWave(post.id).catch(() => {
      setWaved(wasWaved);
      setWaveCount((prev) => Math.max(prev + (wasWaved ? 1 : -1), 0));
    });
  }, [waved, post.id]);

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
            // Menu shape depends on authorship. The author sees Edit
            // text / Delete (per the v1 policy: author may delete or
            // edit text only — no media swap); everyone else sees
            // Follow/Unfollow + Report.
            if (isOwnPost) {
              Alert.alert(post.user.name, null, [
                { text: 'Edit text', onPress: openEdit },
                { text: 'Delete post', style: 'destructive', onPress: handleDelete },
                { text: 'Cancel', style: 'cancel' },
              ]);
              return;
            }
            const followAction = isFriend
              ? { text: 'Unfollow Friend', style: 'destructive', onPress: () => { if (!followLoading) toggleFollow(); } }
              : isFollowing
              ? { text: 'Unfollow', style: 'destructive', onPress: () => { if (!followLoading) toggleFollow(); } }
              : { text: `Follow ${post.user?.name || ''}`.trim(), onPress: () => { if (!followLoading) toggleFollow(); } };
            Alert.alert(post.user.name, null, [
              followAction,
              { text: 'Report', style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ]);
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

      {/* ── Embedded quoted post (LinkedIn-style reshare). Renders
              the original inline as a smaller card-within-card. Tap
              opens the original's detail screen. We render only one
              level deep — if THIS post is itself a quote-repost
              quoted by someone else, the outer card shows the chain
              of two; we don't render the quoted's quoted (prevents
              infinite nesting + keeps the card scannable). */}
      {post.quoted && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={(e) => {
            stop(e);
            nav.navigate('PostDetail', { post: post.quoted });
          }}
          style={[$.quotedCard, {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          }]}
        >
          <View style={$.quotedHeader}>
            <Image source={imageSource(post.quoted.user?.avatar)} style={$.quotedAvatar} />
            <View style={{ flex: 1 }}>
              <View style={$.nameRow}>
                <Text style={[$.quotedName, { color: txt }]} numberOfLines={1}>
                  {post.quoted.user?.name}
                </Text>
                {post.quoted.user?.verified && (
                  <Ionicons name="checkmark-circle" size={11} color="#0A66C2" />
                )}
                {post.quoted.timestamp && (
                  <Text style={[$.quotedMeta, { color: sub }]} numberOfLines={1}>
                    {' · '}{post.quoted.timestamp}
                  </Text>
                )}
              </View>
            </View>
          </View>
          {!!post.quoted.content && (
            <Text style={[$.quotedBody, { color: txt }]} numberOfLines={4}>
              {post.quoted.content}
            </Text>
          )}
          {post.quoted.image && (
            <Image
              source={imageSource(post.quoted.image)}
              style={$.quotedMedia}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>
      )}

      {/* ── Actions row (Twitter-style: icon + count inline). Counts
              render even at 0 so the affordance is obvious — engagement
              research shows visible counters lift participation. The
              first viewer sees "Be the first to wave" as a soft hint. */}
      {POST_INTERACTIONS_ENABLED && (
        <View style={$.actions}>
          <ActionButton
            testID="post-like-action"
            countTestID="post-like-count"
            iconName={reaction.liked ? 'heart' : 'heart-outline'}
            iconSize={24}
            color={reaction.liked ? '#FF3040' : txt}
            mutedColor={sub}
            count={reaction.likeCount}
            active={reaction.liked}
            onPress={(e) => { stop(e); handleLike(); }}
            accessibilityLabel={reaction.liked ? 'Unlike' : 'Like'}
          />
          <ActionButton
            testID="post-comment-action"
            iconName="chatbubble-outline"
            iconSize={22}
            color={txt}
            mutedColor={sub}
            count={post.comments || 0}
            onPress={(e) => { stop(e); handleCardPress(); }}
            accessibilityLabel="Comment"
          />
          <ActionButton
            testID="post-repost-action"
            iconName={reposted ? 'repeat' : 'repeat-outline'}
            iconSize={24}
            color={reposted ? '#009739' : txt}
            mutedColor={sub}
            count={repostCount}
            active={reposted}
            onPress={(e) => { stop(e); openRepostSheet(); }}
            accessibilityLabel={reposted ? 'Undo repost' : 'Repost'}
          />
          <ActionButton
            testID="post-save-action"
            graffitiWave
            waveFilled={waved}
            color={waved ? colors.accent : txt}
            mutedColor={sub}
            count={waveCount}
            active={waved}
            onPress={(e) => { stop(e); handleWave(); }}
            accessibilityLabel={waved ? `Unwave ${post.user?.name || ''}`.trim() : `Wave at ${post.user?.name || ''}`.trim()}
          />
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

      {/* ── Edit text modal — author-only ──────────────────────────── */}
      <Modal
        visible={editOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !savingEdit && setEditOpen(false)}
      >
        <Pressable
          style={$.editOverlay}
          onPress={() => !savingEdit && setEditOpen(false)}
        >
          <Pressable
            style={[$.editSheet, { backgroundColor: colors.cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[$.editTitle, { color: txt }]}>Edit post</Text>
            <Text style={[$.editHint, { color: sub }]}>
              You can change the text only. Photos and links stay the same.
            </Text>
            <TextInput
              style={[$.editInput, {
                color: txt,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={1000}
              placeholder="What's on your mind?"
              placeholderTextColor={sub}
              autoFocus
              editable={!savingEdit}
            />
            <View style={$.editActions}>
              <TouchableOpacity
                onPress={() => setEditOpen(false)}
                disabled={savingEdit}
                style={[$.editBtn, $.editBtnGhost]}
                activeOpacity={0.7}
              >
                <Text style={[$.editBtnText, { color: txt }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveEdit}
                disabled={savingEdit}
                style={[$.editBtn, $.editBtnPrimary, { backgroundColor: colors.accent, opacity: savingEdit ? 0.6 : 1 }]}
                activeOpacity={0.85}
              >
                <Text style={[$.editBtnText, { color: '#FFFFFF', fontFamily: FontFamily.bold }]}>
                  {savingEdit ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </Pressable>
  );
};

export default React.memo(PostCard);

// Standalone style block for the ActionButton sub-component. Kept
// separate from the main `$` map so it stays close to the component
// it serves and doesn't depend on theme colors (text colour is passed
// in as a prop).
const actionStyles = StyleSheet.create({
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  count: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    minWidth: 14,
  },
});

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

  // Action row — Twitter-style: four icon+count buttons spread
  // evenly across the row so each interaction reads as equally
  // available. The inline counts double as the engagement signal,
  // removing the need for the old separate likes line.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  // Legacy — left untouched in case other surfaces import the styles
  // object by name expecting these keys.
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

  // ─── Edit modal ───────────────────────────────────────────────────
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editSheet: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 18,
  },
  editTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
    marginBottom: 4,
  },
  editHint: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginBottom: 12,
  },
  editInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 14,
  },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  editBtnGhost: {
    backgroundColor: 'transparent',
  },
  editBtnPrimary: {},
  editBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
  },

  // ─── Embedded quoted post (LinkedIn-style reshare) ─────────────────
  quotedCard: {
    marginHorizontal: CARD_INSET,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  quotedName: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
  },
  quotedMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
  quotedBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.regular,
  },
  quotedMedia: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },

});
