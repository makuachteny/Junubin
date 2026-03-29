// AnaJunubin — Go Live Screen (Broadcaster View)
// Full-screen camera with live overlay: viewer count, comments, reactions, end stream
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Animated,
  Dimensions,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, useTheme } from '../theme';
import { hapticSelection } from '../utils/haptics';

const { width: W, height: H } = Dimensions.get('window');

// Mock live comments for development
const MOCK_COMMENTS = [
  { id: '1', user: 'Akuol', text: 'You look amazing! \u{1F525}', time: Date.now() - 30000 },
  { id: '2', user: 'Nyajima', text: 'Where are you rn?', time: Date.now() - 25000 },
  { id: '3', user: 'Chan', text: 'YESSSS \u{2728}\u{2728}', time: Date.now() - 15000 },
  { id: '4', user: 'Adut', text: 'This is fire', time: Date.now() - 8000 },
];

const REACTION_EMOJIS = ['\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F60D}', '\u{1F64F}', '\u{1F389}', '\u{1F4AB}'];

export default function GoLiveScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('front');
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [duration, setDuration] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [title, setTitle] = useState('');
  const [showPreLive, setShowPreLive] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const liveBadgeAnim = useRef(new Animated.Value(0)).current;
  const durationRef = useRef(null);
  const reactionIdRef = useRef(0);

  // Pulse animation for LIVE badge
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulseAnim]);

  // Simulate viewers joining
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setViewerCount((v) => {
        const delta = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : -1;
        return Math.max(1, v + delta);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Simulate comments
  useEffect(() => {
    if (!isLive) return;
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < MOCK_COMMENTS.length) {
        setComments((prev) => [...prev, { ...MOCK_COMMENTS[idx], id: `live-${Date.now()}-${idx}` }]);
        idx++;
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Duration timer
  useEffect(() => {
    if (!isLive) return;
    durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(durationRef.current);
  }, [isLive]);

  // Simulate floating reactions
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const emoji = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
      const id = `r-${reactionIdRef.current++}`;
      const anim = new Animated.Value(0);
      setFloatingReactions((prev) => [...prev.slice(-8), { id, emoji, anim }]);
      Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }).start(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [isLive]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleGoLive = useCallback(() => {
    setShowPreLive(false);
    setIsLive(true);
    setViewerCount(1);
    Animated.spring(liveBadgeAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    hapticSelection?.();
  }, [liveBadgeAnim]);

  const handleEndStream = useCallback(() => {
    Alert.alert('End Live?', 'Are you sure you want to end your live stream?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: () => {
          setIsLive(false);
          clearInterval(durationRef.current);
          navigation.goBack();
        },
      },
    ]);
  }, [navigation]);

  const handleFlipCamera = useCallback(() => {
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
    hapticSelection?.();
  }, []);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim()) return;
    setComments((prev) => [
      ...prev,
      { id: `me-${Date.now()}`, user: 'You', text: commentText.trim(), time: Date.now(), isMe: true },
    ]);
    setCommentText('');
  }, [commentText]);

  const handleSendReaction = useCallback((emoji) => {
    const id = `r-${reactionIdRef.current++}`;
    const anim = new Animated.Value(0);
    setFloatingReactions((prev) => [...prev.slice(-8), { id, emoji, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }).start(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    });
    hapticSelection?.();
  }, []);

  // Permission screen
  if (!permission) return <View style={s.permissionScreen} />;
  if (!permission.granted) {
    return (
      <View style={s.permissionScreen}>
        <Ionicons name="videocam-outline" size={64} color="#FFF" />
        <Text style={s.permissionTitle}>Camera Access Required</Text>
        <Text style={s.permissionSub}>Allow camera access to go live and share moments with your community.</Text>
        <TouchableOpacity style={s.permissionBtn} onPress={requestPermission}>
          <Text style={s.permissionBtnText}>Allow Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.permissionBack} onPress={() => navigation.goBack()}>
          <Text style={s.permissionBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Camera */}
      <CameraView style={s.camera} facing={facing} />

      {/* Gradient overlays */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
        style={s.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        style={s.bottomGradient}
        pointerEvents="none"
      />

      {/* ── Pre-live setup screen ── */}
      {showPreLive && (
        <View style={[s.preLiveOverlay, { paddingTop: insets.top + 12 }]}>
          <LinearGradient
            colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Close */}
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={s.preLiveContent}>
            <View style={s.preLiveIconWrap}>
              <LinearGradient colors={['#CE1126', '#F97316']} style={s.preLiveIcon}>
                <Ionicons name="videocam" size={36} color="#FFF" />
              </LinearGradient>
            </View>

            <Text style={s.preLiveTitle}>Go Live</Text>
            <Text style={s.preLiveSub}>Share a moment with the Junubin community</Text>

            <TextInput
              style={s.titleInput}
              placeholder="Add a title for your live..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={title}
              onChangeText={setTitle}
              maxLength={80}
            />

            <TouchableOpacity style={s.goLiveBtn} onPress={handleGoLive} activeOpacity={0.85}>
              <LinearGradient
                colors={['#CE1126', '#F97316']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.goLiveBtnGradient}
              >
                <Ionicons name="radio" size={22} color="#FFF" />
                <Text style={s.goLiveBtnText}>Go Live</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Camera flip */}
            <TouchableOpacity style={s.preLiveFlip} onPress={handleFlipCamera}>
              <Ionicons name="camera-reverse-outline" size={22} color="rgba(255,255,255,0.7)" />
              <Text style={s.preLiveFlipText}>Flip Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Live UI overlay ── */}
      {isLive && (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
            <View style={s.topBarLeft}>
              {/* LIVE badge */}
              <Animated.View style={[s.liveBadge, { transform: [{ scale: pulseAnim }] }]}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>LIVE</Text>
              </Animated.View>

              {/* Duration */}
              <View style={s.durationBadge}>
                <Text style={s.durationText}>{formatDuration(duration)}</Text>
              </View>

              {/* Viewer count */}
              <View style={s.viewerBadge}>
                <Ionicons name="eye" size={14} color="#FFF" />
                <Text style={s.viewerText}>{viewerCount}</Text>
              </View>
            </View>

            <View style={s.topBarRight}>
              <TouchableOpacity style={s.controlBtn} onPress={handleFlipCamera}>
                <Ionicons name="camera-reverse" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.controlBtn, isMuted && s.controlBtnMuted]}
                onPress={() => { setIsMuted((m) => !m); hapticSelection?.(); }}
              >
                <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={s.endBtn} onPress={handleEndStream}>
                <Text style={s.endBtnText}>End</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Title */}
          {title ? (
            <View style={s.titleBanner}>
              <Text style={s.titleBannerText} numberOfLines={1}>{title}</Text>
            </View>
          ) : null}

          {/* Floating reactions */}
          <View style={s.reactionsColumn} pointerEvents="none">
            {floatingReactions.map((r) => (
              <Animated.Text
                key={r.id}
                style={[
                  s.floatingEmoji,
                  {
                    opacity: r.anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      { translateY: r.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -200] }) },
                      { scale: r.anim.interpolate({ inputRange: [0, 0.2, 0.5, 1], outputRange: [0.5, 1.3, 1, 0.8] }) },
                    ],
                  },
                ]}
              >
                {r.emoji}
              </Animated.Text>
            ))}
          </View>

          {/* Comments */}
          <View style={[s.commentsArea, { bottom: insets.bottom + 70 }]}>
            <FlatList
              data={comments.slice(-6)}
              keyExtractor={(item) => item.id}
              inverted={false}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={s.commentBubble}>
                  <Text style={[s.commentUser, item.isMe && s.commentUserMe]}>{item.user}</Text>
                  <Text style={s.commentText}>{item.text}</Text>
                </View>
              )}
            />
          </View>

          {/* Bottom: comment input + reaction buttons */}
          <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.commentInputRow}>
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
              <TouchableOpacity style={s.sendBtn} onPress={handleSendComment}>
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={s.quickReactions}>
              {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={s.quickReactionBtn}
                  onPress={() => handleSendReaction(emoji)}
                >
                  <Text style={s.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject },

  // Gradients
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 5 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, zIndex: 5 },

  // Permission
  permissionScreen: {
    flex: 1, backgroundColor: '#1A1614', justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16,
  },
  permissionTitle: {
    fontSize: 24, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', textAlign: 'center', marginTop: 12,
  },
  permissionSub: {
    fontSize: 15, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22,
  },
  permissionBtn: {
    backgroundColor: '#CE1126', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28, marginTop: 8,
  },
  permissionBtnText: { fontSize: 16, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },
  permissionBack: { marginTop: 8, padding: 8 },
  permissionBackText: { fontSize: 14, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.4)' },

  // Pre-live
  preLiveOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'center', alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 60, left: 20, width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 25,
  },
  preLiveContent: { alignItems: 'center', padding: 32, width: '100%' },
  preLiveIconWrap: { marginBottom: 24 },
  preLiveIcon: {
    width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#CE1126', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20,
  },
  preLiveTitle: {
    fontSize: 32, fontWeight: '900', fontFamily: FontFamily.black, color: '#FFF', marginBottom: 8,
  },
  preLiveSub: {
    fontSize: 15, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 28, lineHeight: 22,
  },
  titleInput: {
    width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFF', paddingHorizontal: 20, paddingVertical: 14,
    fontSize: 15, fontFamily: FontFamily.medium, marginBottom: 24, textAlign: 'center',
  },
  goLiveBtn: { width: '100%', borderRadius: 28, overflow: 'hidden', marginBottom: 20 },
  goLiveBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16,
  },
  goLiveBtnText: { fontSize: 18, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },
  preLiveFlip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8,
  },
  preLiveFlipText: { fontSize: 14, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.5)' },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#CE1126', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FFF' },
  liveText: { fontSize: 12, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', letterSpacing: 1 },

  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  durationText: { fontSize: 12, fontWeight: '600', fontFamily: FontFamily.semibold, color: '#FFF' },

  viewerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  viewerText: { fontSize: 12, fontWeight: '600', fontFamily: FontFamily.semibold, color: '#FFF' },

  controlBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  controlBtnMuted: { backgroundColor: 'rgba(206,17,38,0.5)' },
  endBtn: {
    backgroundColor: '#CE1126', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  endBtnText: { fontSize: 14, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },

  // Title banner
  titleBanner: {
    position: 'absolute', top: 110, left: 16, right: 16, zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8,
  },
  titleBannerText: { fontSize: 14, fontFamily: FontFamily.semibold, color: '#FFF', textAlign: 'center' },

  // Floating reactions
  reactionsColumn: {
    position: 'absolute', right: 16, bottom: 200, width: 50, height: 220, zIndex: 15,
    alignItems: 'center',
  },
  floatingEmoji: { fontSize: 32, position: 'absolute', bottom: 0 },

  // Comments
  commentsArea: {
    position: 'absolute', left: 12, right: 80, height: 180, zIndex: 15,
  },
  commentBubble: {
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 6, alignSelf: 'flex-start', maxWidth: '90%',
  },
  commentUser: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold, color: '#F97316', marginBottom: 1,
  },
  commentUserMe: { color: '#CE1126' },
  commentText: { fontSize: 13, fontFamily: FontFamily.regular, color: '#FFF', lineHeight: 18 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    paddingHorizontal: 12,
  },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10,
  },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)', color: '#FFF', paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, fontFamily: FontFamily.regular,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#CE1126',
    justifyContent: 'center', alignItems: 'center',
  },
  quickReactions: {
    flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 4,
  },
  quickReactionBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  quickReactionEmoji: { fontSize: 20 },
});
