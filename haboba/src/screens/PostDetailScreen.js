import React, { useState, useMemo, useRef, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Typography } from '../theme';
import { mockComments } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { GraffitiSend, GraffitiHeart, GraffitiChat } from '../components/icons';
import PostCard from '../components/PostCard';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';

export default function PostDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { currentUser } = useCurrentUser();

  const post = route.params?.post || {};
  const postId = post.id || 'post1';
  const initialComments = mockComments[postId] || [];
  const [liked, setLiked] = useState(false);

  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState('');
  const [commentLikes, setCommentLikes] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const handleComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: `c-${Date.now()}`,
      user: { name: currentUser.name, avatar: currentUser.images?.[0] },
      text: commentText.trim(),
      time: 'Just now',
      likes: 0,
      replyTo: replyTo || null,
    };
    setComments((prev) => [...prev, newComment]);
    setCommentText('');
    setReplyTo(null);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const handleCommentLike = (commentId) => {
    setCommentLikes((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleReply = (userName) => {
    setReplyTo(userName);
    setCommentText(`@${userName} `);
    inputRef.current?.focus();
  };

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
        <PostCard post={post} />

        {/* ─── Engagement Bar (LinkedIn-style) ─── */}
        <View style={styles.engagementBar}>
          <View style={styles.engagementCounts}>
            <Text style={styles.engagementText}>
              {(post.likes || 0) + (liked ? 1 : 0)} likes
            </Text>
            <Text style={styles.engagementDot}>•</Text>
            <Text style={styles.engagementText}>
              {comments.length} comments
            </Text>
          </View>
          <View style={styles.engagementActions}>
            <TouchableOpacity style={styles.engagementBtn} onPress={() => setLiked((p) => !p)} activeOpacity={0.7}>
              <GraffitiHeart size={16} color={liked ? colors.rose : colors.gray500} filled={liked} />
              <Text style={[styles.engagementBtnText, liked && { color: colors.rose }]}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.engagementBtn} onPress={() => inputRef.current?.focus()} activeOpacity={0.7}>
              <GraffitiChat size={16} color={colors.gray500} />
              <Text style={styles.engagementBtnText}>Comment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.engagementBtn} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={16} color={colors.gray500} />
              <Text style={styles.engagementBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Comments Section Divider ─── */}
        <View style={styles.commentsDivider}>
          <LinearGradient
            colors={isDark ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'] : ['rgba(0,0,0,0)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dividerLine}
          />
          <View style={styles.commentsDividerPill}>
            <GraffitiChat size={14} color={colors.accent} />
            <Text style={styles.commentsDividerText}>
              Comments ({comments.length})
            </Text>
          </View>
          <LinearGradient
            colors={isDark ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)'] : ['rgba(0,0,0,0)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dividerLine}
          />
        </View>

        {/* ─── Comments List ─── */}
        <View style={styles.commentsSection}>
          {comments.length === 0 && (
            <EmptyState
              icon="chatbubble-outline"
              title="No comments yet"
              subtitle="Be the first to share your thoughts!"
            />
          )}

          {comments.map((comment) => {
            const isLiked = commentLikes[comment.id];
            const isOwn = comment.user.name === currentUser.name;
            return (
              <View key={comment.id} style={styles.commentRow}>
                <Image source={imageSource(comment.user.avatar)} style={[styles.commentAvatar, isOwn && styles.commentAvatarOwn]} />
                <View style={styles.commentBody}>
                  <View style={[styles.commentBubble, isOwn && styles.commentBubbleOwn]}>
                    <View style={styles.commentNameRow}>
                      <View style={styles.commentNameLeft}>
                        <Text style={styles.commentName}>{comment.user.name}</Text>
                        {isOwn && <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>}
                      </View>
                      <Text style={styles.commentTime}>{comment.time}</Text>
                    </View>
                    {comment.replyTo && (
                      <Text style={styles.commentReplyTag}>Replying to @{comment.replyTo}</Text>
                    )}
                    <Text style={styles.commentText}>{comment.text}</Text>
                  </View>

                  {/* Comment actions */}
                  <View style={styles.commentActions}>
                    <TouchableOpacity
                      style={styles.commentActionBtn}
                      onPress={() => handleCommentLike(comment.id)}
                      activeOpacity={0.7}
                    >
                      <GraffitiHeart size={14} color={isLiked ? colors.rose : colors.gray400} filled={isLiked} />
                      <Text style={[styles.commentActionText, isLiked && { color: colors.rose }]}>
                        {comment.likes + (isLiked ? 1 : 0)}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.commentActionBtn}
                      onPress={() => handleReply(comment.user.name)}
                      activeOpacity={0.7}
                    >
                      <GraffitiChat size={13} color={colors.gray400} />
                      <Text style={styles.commentActionText}>Reply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                Replying to <Text style={{ fontWeight: '700', color: colors.accent }}>@{replyTo}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setReplyTo(null); setCommentText(''); }}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <Image source={imageSource(currentUser.images?.[0])} style={styles.inputAvatar} />
          <View style={styles.inputWrap}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder={replyTo ? `Reply to @${replyTo}...` : 'Add a comment...'}
              placeholderTextColor={colors.gray400}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={300}
            />
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
    backgroundColor: colors.white,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.white,
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

  // ─── Comments Divider ───
  commentsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  commentsDividerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  },
  commentsDividerText: {
    ...Typography.captionBold,
    fontSize: 13,
    color: colors.black,
  },

  // ─── Engagement Bar ───
  engagementBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
  },
  engagementCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  engagementText: {
    ...Typography.caption,
    color: colors.gray600,
  },
  engagementDot: {
    color: colors.gray400,
  },
  engagementActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  engagementBtnText: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.gray500,
  },

  // ─── Comments List ───
  commentsSection: {
    paddingHorizontal: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    marginTop: 2,
    backgroundColor: colors.gray300,
  },
  commentAvatarOwn: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  commentBody: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  commentBubbleOwn: {
    backgroundColor: isDark ? 'rgba(206,17,38,0.08)' : 'rgba(206,17,38,0.04)',
    borderColor: isDark ? 'rgba(206,17,38,0.15)' : 'rgba(206,17,38,0.08)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  commentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentNameLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentName: {
    ...Typography.captionBold,
    fontSize: 13,
    color: colors.black,
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: isDark ? 'rgba(206,17,38,0.2)' : 'rgba(206,17,38,0.1)',
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
  },
  commentTime: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: colors.gray400,
  },
  commentReplyTag: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.accent,
    marginBottom: 4,
  },
  commentText: {
    ...Typography.caption,
    color: colors.black,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.gray400,
  },

  // ─── Comment Input ───
  commentInput: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(206,17,38,0.03)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
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
