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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { POST_THEMES, mockComments } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { useFollow } from '../hooks/useFollow';
import { GraffitiSend } from '../components/icons';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';

export default function PostDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { currentUser } = useCurrentUser();

  const post = route.params?.post || {};
  const postId = post.id || 'post1';
  const initialComments = mockComments[postId] || [];

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [comments, setComments] = useState(initialComments);
  const [commentText, setCommentText] = useState('');
  const { isFollowing: following, isFriend, toggleFollow } = useFollow(post.user?.id);
  const [commentLikes, setCommentLikes] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef(null);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  }, []);

  const theme = POST_THEMES[post.cardTheme] || POST_THEMES.default;
  const isDarkCard = theme.bg === '#262626' || theme.bg === '#0C4A6E' || theme.bg === '#14532D' || theme.bg === '#7C2D12';

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleFollow = () => {
    toggleFollow();
  };

  const handleShare = () => {
    Alert.alert('Share', 'Post link copied to clipboard!');
  };

  const handleComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: `c-${Date.now()}`,
      user: { name: currentUser.name, avatar: currentUser.images?.[0] },
      text: commentText.trim(),
      time: 'Just now',
      likes: 0,
    };
    setComments((prev) => [...prev, newComment]);
    setCommentText('');
  };

  const handleCommentLike = (commentId) => {
    setCommentLikes((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Post card */}
        <View style={[styles.postCard, { backgroundColor: theme.bg }]}>
          {/* Post header */}
          <View style={styles.postHeader}>
            <Image source={imageSource(post.user?.avatar)} style={styles.postAvatar} />
            <View style={styles.postHeaderInfo}>
              <Text style={[styles.postUserName, { color: theme.text }]}>{post.user?.name}</Text>
              <Text style={[styles.postMeta, { color: isDarkCard ? 'rgba(255,255,255,0.5)' : colors.gray400 }]}>
                {post.user?.location} · {post.timestamp}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.followBtn, { backgroundColor: following ? 'transparent' : theme.accent, borderColor: theme.accent, borderWidth: following ? 1.5 : 0 }]}
              onPress={handleFollow}
              activeOpacity={0.8}
            >
              {isFriend && <Ionicons name="people" size={12} color={theme.accent} style={{ marginRight: 3 }} />}
              <Text style={[styles.followBtnText, { color: following ? theme.accent : (isDarkCard ? '#000' : '#FFF') }]}>
                {isFriend ? 'Friends' : following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {post.content && (
            <Text style={[styles.postContent, { color: theme.text }]}>{post.content}</Text>
          )}

          {/* Image */}
          {post.image && (
            <Image source={imageSource(post.image)} style={styles.postImage} />
          )}

          {/* Actions */}
          <View style={[styles.postActions, { borderTopColor: isDarkCard ? 'rgba(255,255,255,0.1)' : colors.separator }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? colors.accent : (isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400)}
              />
              <Text style={[styles.actionText, { color: liked ? colors.accent : (isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400) }]}>
                {likeCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              <Ionicons name="chatbubble" size={20} color={isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400} />
              <Text style={[styles.actionText, { color: isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400 }]}>
                {comments.length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400} />
              <Text style={[styles.actionText, { color: isDarkCard ? 'rgba(255,255,255,0.6)' : colors.gray400 }]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>

          {comments.length === 0 && (
            <EmptyState
              icon="chatbubble-outline"
              title="No comments yet"
              subtitle="Start the conversation!"
            />
          )}

          {comments.map((comment) => {
            const isLiked = commentLikes[comment.id];
            return (
              <View key={comment.id} style={styles.commentRow}>
                <Image source={imageSource(comment.user.avatar)} style={styles.commentAvatar} />
                <View style={styles.commentBody}>
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentName}>{comment.user.name}</Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                  </View>
                  <View style={styles.commentActions}>
                    <Text style={styles.commentTime}>{comment.time}</Text>
                    <TouchableOpacity onPress={() => handleCommentLike(comment.id)}>
                      <Text style={[styles.commentAction, isLiked && { color: colors.accent }]}>
                        Like{isLiked ? 'd' : ''} ({comment.likes + (isLiked ? 1 : 0)})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setReplyTo(comment.user.name); setCommentText(`@${comment.user.name} `); }}>
                      <Text style={styles.commentAction}>Reply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Comment input */}
      <View style={[styles.commentInput, { paddingBottom: insets.bottom + 8 }]}>
        <Image source={imageSource(currentUser.images?.[0])} style={styles.inputAvatar} />
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textInput}
            placeholder="Write a comment..."
            placeholderTextColor={colors.gray400}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={300}
          />
        </View>
        {commentText.trim() ? (
          <TouchableOpacity onPress={handleComment} style={styles.sendBtn}>
            <GraffitiSend size={18} color="#FFFFFF" filled />
          </TouchableOpacity>
        ) : null}
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  body: {
    flex: 1,
  },
  postCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: colors.gray300,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postUserName: {
    ...Typography.bodySemibold,
    fontSize: 15,
  },
  postMeta: {
    ...Typography.caption,
    marginTop: 1,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  followBtnText: {
    ...Typography.captionBold,
  },
  postContent: {
    ...Typography.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingBottom: 14,
    lineHeight: 24,
  },
  postImage: {
    width: '100%',
    height: 260,
    resizeMode: 'cover',
  },
  postActions: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 24,
    borderTopWidth: 0.5,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    ...Typography.bodySmallMedium,
  },
  commentsSection: {
    paddingHorizontal: 16,
  },
  commentsTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
    marginBottom: 16,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: colors.gray300,
  },
  commentBody: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: colors.cream,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  commentName: {
    ...Typography.captionBold,
    color: colors.black,
    marginBottom: 3,
  },
  commentText: {
    ...Typography.bodySmall,
    color: colors.black,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  commentTime: {
    ...Typography.caption,
    color: colors.gray400,
  },
  commentAction: {
    ...Typography.caption,
    color: colors.gray,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 0.5,
    borderTopColor: colors.gray200,
    gap: 10,
  },
  inputAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: colors.gray300,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 80,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  textInput: {
    ...Typography.bodySmall,
    fontSize: 14,
    color: colors.black,
    maxHeight: 60,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});
