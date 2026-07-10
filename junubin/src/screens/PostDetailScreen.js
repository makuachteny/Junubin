import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Typography } from '../theme';
import { imageSource } from '../utils/imageSource';
import { reportError } from '../utils/reportError';
import { useCurrentUser } from '../hooks';
import { GraffitiSend } from '../components/icons';
import PostCard from '../components/PostCard';
import EmptyState from '../components/EmptyState';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import * as commentService from '../api/services/commentService';
import { mockComments } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';

// Real Post.id values come from `crypto.randomUUID()` (UUID v4) or the
// legacy `p_*` prefix the older postService fallback used. An id in
// any other shape means the post hasn't been persisted yet (local
// optimistic insert before the server INSERT lands) — calling
// commentService on it would either return [] or fail the FK check.
// Treat those as "skip the network round trip".
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isLocalOnlyPostId = (id) => {
  if (!id) return true;
  const s = String(id);
  return !UUID_RE.test(s) && !s.startsWith('p_');
};

const QUICK_EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

// Single comment row — used for both top-level and replies (replies are
// rendered indented + with a smaller avatar).
function CommentRow({
  comment,
  isReply,
  styles,
  colors,
  isOwn,
  isLiked,
  onLike,
  onReply,
  replyCount,
  isExpanded,
  onToggleThread,
}) {
  const totalLikes = (comment.likes || 0) + (isLiked ? 1 : 0);
  return (
    <View style={[styles.commentRow, isReply && styles.replyRow]}>
      <Image
        source={imageSource(comment.user.avatar)}
        style={[
          styles.commentAvatar,
          isReply && styles.replyAvatar,
          isOwn && styles.commentAvatarOwn,
        ]}
      />
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentName} numberOfLines={1}>{comment.user.name}</Text>
          {comment.user.verified && (
            <Ionicons name="checkmark-circle" size={13} color="#0A66C2" style={{ marginLeft: 4 }} />
          )}
          <Text style={styles.commentTime}>  {comment.time}</Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
        <View style={styles.commentMetaRow}>
          <TouchableOpacity onPress={onReply} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.replyLink}>Reply</Text>
          </TouchableOpacity>
          {!isReply && replyCount > 0 && (
            <TouchableOpacity onPress={onToggleThread} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={styles.viewMoreReplies}>
                ──   {isExpanded ? 'Hide' : 'View'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.likeColumn}
        onPress={onLike}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name={isLiked ? 'heart' : 'heart-outline'}
          size={isReply ? 16 : 18}
          color={isLiked ? colors.rose : colors.gray500}
        />
        {totalLikes > 0 && (
          <Text style={[styles.likeColumnCount, isLiked && { color: colors.rose }]}>
            {totalLikes}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function PostDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { currentUser } = useCurrentUser();

  const post = route.params?.post;
  const postId = post?.id;
  // Comments come from PostComment table via commentService for real
  // posts. Demo posts (id starts with `demo_post_`) fall back to the
  // seeded mockComments map keyed off the post id.
  const isDemoPost = typeof postId === 'string' && postId.startsWith('demo_post_');
  const initialComments = (DEMO_DATA_ENABLED && isDemoPost)
    ? (mockComments[postId] || [])
    : [];
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState('');
  const [commentLikes, setCommentLikes] = useState({});
  // Reply target carries both user (display) + parent comment id (threading).
  const [replyTo, setReplyTo] = useState(null);
  // Threads stay collapsed by default. Tap "View N more replies" to expand.
  // Threads where the user just posted a reply are auto-added so users see
  // their own comment without having to expand again.
  const [expandedThreads, setExpandedThreads] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Load comments from the server for real posts. Mock posts skip this.
  useEffect(() => {
    if (!postId || isLocalOnlyPostId(postId)) return;
    let cancelled = false;
    commentService.listComments(postId)
      .then((rows) => { if (!cancelled) setComments(rows); })
      .catch((err) => reportError('PostDetailScreen.listComments', err, { postId }));
    return () => { cancelled = true; };
  }, [postId]);

  // Group comments into top-level + replies-by-parent.
  const { topLevel, repliesByParent } = useMemo(() => {
    const top = [];
    const byParent = new Map();
    for (const c of comments) {
      if (c.parentId) {
        if (!byParent.has(c.parentId)) byParent.set(c.parentId, []);
        byParent.get(c.parentId).push(c);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesByParent: byParent };
  }, [comments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (!postId || isLocalOnlyPostId(postId)) {
      setTimeout(() => setRefreshing(false), 300);
      return;
    }
    commentService.listComments(postId)
      .then(setComments)
      .catch((err) => reportError('PostDetailScreen.refreshComments', err, { postId }))
      .finally(() => setRefreshing(false));
  }, [postId]);

  // Optimistic comment add: append a temp row immediately so the input
  // clears and the user sees their comment, then swap it for the
  // server-issued row (so subsequent operations like delete have the
  // real id). On failure, drop the temp row and restore the input.
  const postComment = useCallback(async (text) => {
    if (!text) return;
    const parentId = replyTo?.parentId || null;
    const tempId = `temp-${Date.now()}`;
    const tempComment = {
      id: tempId,
      user: { name: currentUser.name, avatar: currentUser.images?.[0] },
      text,
      time: 'Just now',
      likes: 0,
      parentId,
    };
    setComments((prev) => [...prev, tempComment]);
    if (parentId) {
      setExpandedThreads((prev) => new Set(prev).add(parentId));
    }
    setReplyTo(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);

    if (!postId || isLocalOnlyPostId(postId)) return; // demo post — keep local-only
    try {
      const real = await commentService.addComment({ postId, content: text, parentId });
      setComments((prev) => prev.map((c) => (c.id === tempId ? real : c)));
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentText(text);
    }
  }, [currentUser, replyTo, postId]);

  const handleComment = () => {
    const text = commentText.trim();
    if (!text) return;
    setCommentText('');
    postComment(text);
  };

  // Tap an emoji shortcut → append it to the draft comment and bring
  // up the keyboard. The user then types around it / hits Send when
  // ready. Previously this fired off the emoji as its own comment
  // immediately, which made the row feel like an "unsend" button.
  const handleEmojiInsert = useCallback((emoji) => {
    setCommentText((prev) => (prev || '') + emoji);
    // Defer focus so the appended text is rendered before the cursor
    // lands — otherwise the keyboard sometimes opens on a stale value.
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleCommentLike = (commentId) => {
    setCommentLikes((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  // Reply targets a specific top-level comment id (so the reply nests there).
  const handleReply = (parent) => {
    setReplyTo({ user: parent.user.name, parentId: parent.id });
    setCommentText(`@${parent.user.name} `);
    inputRef.current?.focus();
  };

  const toggleThread = (parentId) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  };

  // No post passed in (deep link with stale data, or a navigation
  // bug) — show an EmptyState instead of silently rendering an
  // unrelated post's comments.
  if (!post || !postId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.black} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Post</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          icon="alert-circle-outline"
          title="Post unavailable"
          subtitle="This post may have been removed."
          actionLabel="Back to feed"
          onAction={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Post</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* ─── The Post itself — rendered as a full PostCard ─── */}
        <PostCard
          post={{ ...post, comments: comments.length }}
          pressEnabled={false}
          hideViewAllComments
        />

        {/* ─── Comments List ─── */}
        <View style={styles.commentsSection}>
          {comments.length === 0 && (
            <EmptyState
              icon="chatbubble-outline"
              title="No comments yet"
              subtitle="Be the first to share your thoughts!"
            />
          )}

          {topLevel.map((comment) => {
            const replies = repliesByParent.get(comment.id) || [];
            const isExpanded = expandedThreads.has(comment.id);
            return (
              <View key={comment.id}>
                <CommentRow
                  comment={comment}
                  isReply={false}
                  styles={styles}
                  colors={colors}
                  isOwn={comment.user.name === currentUser.name}
                  isLiked={!!commentLikes[comment.id]}
                  onLike={() => handleCommentLike(comment.id)}
                  onReply={() => handleReply(comment)}
                  replyCount={replies.length}
                  isExpanded={isExpanded}
                  onToggleThread={() => toggleThread(comment.id)}
                />
                {/* Threaded replies — collapsed by default */}
                {isExpanded && replies.map((reply) => (
                  <CommentRow
                    key={reply.id}
                    comment={reply}
                    isReply
                    styles={styles}
                    colors={colors}
                    isOwn={reply.user.name === currentUser.name}
                    isLiked={!!commentLikes[reply.id]}
                    onLike={() => handleCommentLike(reply.id)}
                    onReply={() => handleReply(comment)}
                    replyCount={0}
                  />
                ))}
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ─── Comment Input ─── */}
      <View style={[styles.commentInput, { paddingBottom: insets.bottom + 8 }]}>
        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarLeft}>
              <Ionicons name="return-down-forward" size={14} color={colors.accent} />
              <Text style={styles.replyBarText}>
                Replying to <Text style={{ fontWeight: '700', color: colors.accent }}>@{replyTo.user}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setReplyTo(null); setCommentText(''); }}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        )}

        {/* Emoji shortcuts — tap to append the emoji to the draft. The
            user can then keep typing and send when ready. */}
        <View style={styles.emojiRow}>
          {QUICK_EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiBtn}
              onPress={() => handleEmojiInsert(emoji)}
              activeOpacity={0.6}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji} to comment`}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputRow}>
          <Image source={imageSource(currentUser.images?.[0])} style={styles.inputAvatar} />
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={replyTo ? `Reply to @${replyTo.user}...` : 'What do you think of this?'}
              placeholderTextColor={colors.gray500}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={300}
            />
            <TouchableOpacity style={styles.stickerBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="happy-outline" size={20} color={colors.gray500} />
            </TouchableOpacity>
          </View>
          {commentText.trim() ? (
            <TouchableOpacity onPress={handleComment} style={styles.sendBtn} activeOpacity={0.8}>
              <GraffitiSend size={18} color="#FFFFFF" filled />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
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
  },
  headerTitle: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  body: {
    flex: 1,
  },



  // ─── Comments List — Instagram-style flat layout ───
  // Horizontal padding mirrors PostCard's outer inset (CARD_INSET = 12)
  // plus its internal content padding (~12) so the comment avatars line
  // up vertically with Adau's avatar inside the post card above.
  commentsSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 18,
    alignItems: 'flex-start',
  },
  // Indented reply row — smaller avatar, left padding mimics IG threading
  replyRow: {
    paddingLeft: 50,
    marginBottom: 14,
    marginTop: -6,
  },
  // Avatar sized + spaced to match PostCard.header (32px avatar + 10
  // gap). Keeping these in lockstep means names and timestamps line up
  // vertically between the post-card row above and the comment rows
  // below, instead of staggering by ~8px.
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginTop: 1,
    backgroundColor: colors.gray300,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
  },
  commentAvatarOwn: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  commentBody: {
    flex: 1,
    paddingRight: 8,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  commentName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    letterSpacing: -0.1,
  },
  verifiedDot: {},
  commentTime: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },
  commentReplyTag: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.accent,
    marginTop: 1,
  },
  commentText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: colors.black,
    lineHeight: 19,
    marginTop: 3,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  replyLink: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.gray500,
  },
  viewMoreReplies: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: colors.gray400,
  },
  likeColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    minWidth: 28,
  },
  likeColumnCount: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    marginTop: 2,
  },

  // ─── Comment Input ───
  // The whole dock — replyBar + emojiRow + inputRow — sits on a single
  // cardBg surface with one top border. All three children share the
  // same horizontal padding so the composer reads as one cohesive
  // group rather than three stacked bands.
  commentInput: {
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    paddingTop: 4,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 14,
    marginBottom: 4,
    borderRadius: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(206,17,38,0.05)',
  },
  replyBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  replyBarText: {
    ...Typography.caption,
    fontSize: 13,
    color: colors.gray600,
  },
  // Reactions sit just above the input. Smaller emoji + tighter padding
  // so they feel like a shortcut row inside the composer rather than
  // their own standalone section.
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
  },
  emojiBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  emojiText: {
    fontSize: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 0,
    paddingBottom: 2,
    gap: 10,
  },
  stickerBtn: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    padding: 2,
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginBottom: 4,
    backgroundColor: colors.gray300,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingRight: 40,
    paddingVertical: 10,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },
  textInput: {
    ...Typography.caption,
    color: colors.black,
    maxHeight: 65,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});
