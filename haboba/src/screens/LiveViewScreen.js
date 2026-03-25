// AnaJunubin — Live View Screen (Viewer watching someone's live stream)
// Full-screen with live comments, reactions, viewer count, follow button
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { hapticSelection } from '../utils/haptics';
import { useFollow } from '../hooks/useFollow';

const { width: W, height: H } = Dimensions.get('window');

const REACTION_EMOJIS = ['\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F60D}', '\u{1F64F}', '\u{1F389}', '\u{1F4AB}'];

const MOCK_LIVE_COMMENTS = [
  { id: '1', user: 'Garang', text: 'Just joined! \u{1F44B}', time: 0 },
  { id: '2', user: 'Nyandeng', text: 'This is so cool', time: 3000 },
  { id: '3', user: 'Abuk', text: '\u{1F525}\u{1F525}\u{1F525}', time: 6000 },
  { id: '4', user: 'Deng', text: 'Where is this?', time: 9000 },
  { id: '5', user: 'Alek', text: 'Missed the beginning, what happened?', time: 13000 },
  { id: '6', user: 'Majok', text: 'You look great!', time: 17000 },
  { id: '7', user: 'Achol', text: 'Can you show us around?', time: 22000 },
];

export default function LiveViewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const liveData = route.params?.liveData || {};
  const { userName, avatar, title, viewerCount: initialViewers = 42 } = liveData;

  const { isFollowing, isFriend, toggleFollow } = useFollow(liveData.userId);
  const [viewerCount, setViewerCount] = useState(initialViewers);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [duration, setDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reactionIdRef = useRef(0);
  const commentIdxRef = useRef(0);

  // LIVE badge pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Simulate viewer count changes
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount((v) => {
        const delta = Math.random() > 0.3 ? Math.floor(Math.random() * 2) + 1 : -1;
        return Math.max(1, v + delta);
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Simulate comments flowing in
  useEffect(() => {
    const interval = setInterval(() => {
      if (commentIdxRef.current < MOCK_LIVE_COMMENTS.length) {
        const comment = MOCK_LIVE_COMMENTS[commentIdxRef.current];
        setComments((prev) => [...prev, { ...comment, id: `lv-${Date.now()}-${commentIdxRef.current}` }]);
        commentIdxRef.current++;
      }
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulate random floating reactions
  useEffect(() => {
    const interval = setInterval(() => {
      const emoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
      spawnReaction(emoji);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const spawnReaction = useCallback((emoji) => {
    const id = `r-${reactionIdRef.current++}`;
    const anim = new Animated.Value(0);
    const xOffset = Math.random() * 30 - 15;
    setFloatingReactions((prev) => [...prev.slice(-10), { id, emoji, anim, xOffset }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim()) return;
    setComments((prev) => [
      ...prev,
      { id: `me-${Date.now()}`, user: 'You', text: commentText.trim(), time: Date.now(), isMe: true },
    ]);
    setCommentText('');
  }, [commentText]);

  const handleReaction = useCallback((emoji) => {
    spawnReaction(emoji);
    hapticSelection?.();
  }, [spawnReaction]);

  return (
    <View style={s.root}>
      {/* Placeholder for live video — In production, this would be the actual stream */}
      <View style={s.videoPlaceholder}>
        <Image source={imageSource(avatar)} style={s.placeholderImage} blurRadius={20} />
        <View style={s.videoOverlay} />
        <View style={s.videoCenter}>
          <Image source={imageSource(avatar)} style={s.videoAvatar} />
          <Text style={s.videoStreamText}>Watching {userName}'s Live</Text>
          <Text style={s.videoStreamSub}>Live video stream</Text>
        </View>
      </View>

      {/* Gradient overlays */}
      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
        style={s.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
        style={s.bottomGradient}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={s.topBarLeft}>
            {/* Streamer info */}
            <TouchableOpacity style={s.streamerInfo} activeOpacity={0.8}>
              <Image source={imageSource(avatar)} style={s.streamerAvatar} />
              <View>
                <Text style={s.streamerName}>{userName || 'User'}</Text>
                <View style={s.streamerMeta}>
                  <Animated.View style={[s.liveBadgeSmall, { transform: [{ scale: pulseAnim }] }]}>
                    <View style={s.liveDotSmall} />
                    <Text style={s.liveTextSmall}>LIVE</Text>
                  </Animated.View>
                  <Text style={s.viewerText}>{viewerCount} watching</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Follow button */}
            <TouchableOpacity
              style={[s.followBtn, (isFollowing || isFriend) && s.followBtnActive]}
              onPress={() => { toggleFollow(); hapticSelection?.(); }}
            >
              {isFriend && <Ionicons name="people" size={12} color="rgba(255,255,255,0.7)" style={{ marginRight: 3 }} />}
              <Text style={[s.followBtnText, (isFollowing || isFriend) && s.followBtnTextActive]}>
                {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Title banner */}
        {title ? (
          <View style={s.titleBanner}>
            <Text style={s.titleBannerText} numberOfLines={1}>{title}</Text>
          </View>
        ) : null}

        {/* Duration */}
        <View style={s.durationPill}>
          <Text style={s.durationText}>{formatDuration(duration)}</Text>
        </View>

        {/* Floating reactions */}
        <View style={s.reactionsColumn} pointerEvents="none">
          {floatingReactions.map((r) => (
            <Animated.Text
              key={r.id}
              style={[
                s.floatingEmoji,
                {
                  opacity: r.anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
                  transform: [
                    { translateY: r.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -220] }) },
                    { translateX: r.xOffset || 0 },
                    { scale: r.anim.interpolate({ inputRange: [0, 0.15, 0.4, 1], outputRange: [0.3, 1.4, 1, 0.7] }) },
                  ],
                },
              ]}
            >
              {r.emoji}
            </Animated.Text>
          ))}
        </View>

        {/* Comments overlay */}
        <View style={[s.commentsArea, { bottom: insets.bottom + 70 }]}>
          <FlatList
            data={comments.slice(-8)}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={s.commentBubble}>
                <Text style={[s.commentUser, item.isMe && s.commentUserMe]}>{item.user}</Text>
                <Text style={s.commentText}>{item.text}</Text>
              </View>
            )}
          />
        </View>

        {/* Bottom: comment + reactions */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.inputRow}>
            <TextInput
              style={s.commentInput}
              placeholder="Say something..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={commentText}
              onChangeText={setCommentText}
              maxLength={120}
              returnKeyType="send"
              onSubmitEditing={handleSendComment}
            />
            {commentText.trim() ? (
              <TouchableOpacity style={s.sendBtn} onPress={handleSendComment}>
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            ) : null}
            {REACTION_EMOJIS.slice(0, 3).map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={s.quickReaction}
                onPress={() => handleReaction(emoji)}
              >
                <Text style={s.quickReactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.giftBtn} onPress={() => hapticSelection?.()}>
              <Ionicons name="gift" size={20} color="#F97316" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Video placeholder
  videoPlaceholder: { ...StyleSheet.absoluteFillObject },
  placeholderImage: { width: W, height: H, position: 'absolute' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  videoCenter: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  videoAvatar: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#CE1126', marginBottom: 16,
  },
  videoStreamText: {
    fontSize: 18, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF', marginBottom: 4,
  },
  videoStreamSub: {
    fontSize: 13, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.4)',
  },

  // Gradients
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 5 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, zIndex: 5 },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  streamerInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 24, paddingRight: 12, paddingVertical: 4, paddingLeft: 4,
  },
  streamerAvatar: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#CE1126',
  },
  streamerName: { fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },
  streamerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBadgeSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#CE1126', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  liveDotSmall: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF' },
  liveTextSmall: { fontSize: 9, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', letterSpacing: 0.5 },
  viewerText: { fontSize: 11, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.6)' },

  followBtn: {
    backgroundColor: '#CE1126', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
  },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  followBtnText: { fontSize: 12, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },
  followBtnTextActive: { color: 'rgba(255,255,255,0.7)' },

  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Title
  titleBanner: {
    position: 'absolute', top: 100, left: 16, right: 16, zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  titleBannerText: { fontSize: 14, fontFamily: FontFamily.semibold, color: '#FFF', textAlign: 'center' },

  // Duration
  durationPill: {
    position: 'absolute', top: 100, alignSelf: 'center', zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  durationText: { fontSize: 11, fontWeight: '600', fontFamily: FontFamily.semibold, color: 'rgba(255,255,255,0.6)' },

  // Floating reactions
  reactionsColumn: {
    position: 'absolute', right: 16, bottom: 200, width: 60, height: 250, zIndex: 15, alignItems: 'center',
  },
  floatingEmoji: { fontSize: 34, position: 'absolute', bottom: 0 },

  // Comments
  commentsArea: {
    position: 'absolute', left: 12, right: 80, height: 200, zIndex: 15,
  },
  commentBubble: {
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 6, alignSelf: 'flex-start', maxWidth: '90%',
  },
  commentUser: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold, color: '#F97316', marginBottom: 1 },
  commentUserMe: { color: '#E8613C' },
  commentText: { fontSize: 13, fontFamily: FontFamily.regular, color: '#FFF', lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 12,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)', color: '#FFF', paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, fontFamily: FontFamily.regular,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#CE1126',
    justifyContent: 'center', alignItems: 'center',
  },
  quickReaction: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  quickReactionEmoji: { fontSize: 18 },
  giftBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
});
