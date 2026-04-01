// AnaJunubin — Live View Screen (TikTok-style scrollable live streams)
// Full-screen paginated vertical scroll with request-to-join, comments, reactions, gifting
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
  Modal,
  Pressable,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { hapticSelection } from '../utils/haptics';
import { useFollow } from '../hooks/useFollow';
import { useSubscription } from '../payments';
import { GIFTS } from '../data/gifts';
import CoinPurchaseSheet from '../components/CoinPurchaseSheet';

const { width: W, height: H } = Dimensions.get('window');

const REACTION_EMOJIS = ['\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F60D}', '\u{1F64F}', '\u{1F389}', '\u{1F4AB}'];

const MOCK_COMMENTS = [
  { id: '1', user: 'Garang', text: 'Just joined! \u{1F44B}' },
  { id: '2', user: 'Nyandeng', text: 'This is so cool' },
  { id: '3', user: 'Abuk', text: '\u{1F525}\u{1F525}\u{1F525}' },
  { id: '4', user: 'Deng', text: 'Where is this?' },
  { id: '5', user: 'Alek', text: 'Amazing!' },
  { id: '6', user: 'Majok', text: 'You look great!' },
];

// ── Single Live Stream Page ──
function LiveStreamPage({ item, navigation, isActive, insets }) {
  const { name: userName, image, caption: title, viewers: initialViewers = 42 } = item;
  const avatar = item.avatar || item.image;

  const { isFollowing, isFriend, toggleFollow } = useFollow(item.userId || item.id || null);
  const { coins, consumeCoins } = useSubscription();

  const [joinStatus, setJoinStatus] = useState('none'); // none | pending | joined
  const [viewerCount, setViewerCount] = useState(initialViewers);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [showGiftSheet, setShowGiftSheet] = useState(false);
  const [showCoinSheet, setShowCoinSheet] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const joinAnim = useRef(new Animated.Value(0)).current;
  const joinTimeoutRef = useRef(null);
  const reactionIdRef = useRef(0);
  const commentIdxRef = useRef(0);

  // Pulse animation
  useEffect(() => {
    if (!isActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, pulseAnim]);

  // Viewer count simulation
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setViewerCount(v => Math.max(1, v + (Math.random() > 0.3 ? 1 : -1)));
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive]);

  // Auto comments — always visible (you can read chat without joining)
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      if (commentIdxRef.current < MOCK_COMMENTS.length) {
        const c = MOCK_COMMENTS[commentIdxRef.current];
        setComments(prev => [...prev, { ...c, id: `lv-${Date.now()}-${commentIdxRef.current}` }]);
        commentIdxRef.current++;
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [isActive]);

  // Auto reactions — always visible
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      spawnReaction(REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [isActive]);

  const spawnReaction = useCallback((emoji) => {
    const id = `r-${reactionIdRef.current++}`;
    const anim = new Animated.Value(0);
    const xOffset = Math.random() * 30 - 15;
    setFloatingReactions(prev => [...prev.slice(-10), { id, emoji, anim, xOffset }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    });
  }, []);

  const handleRequestJoin = useCallback(() => {
    if (joinStatus === 'pending') return;
    setJoinStatus('pending');
    hapticSelection?.();
    Animated.timing(joinAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    // Simulate host accepting
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = setTimeout(() => {
      setJoinStatus('joined');
      Animated.timing(joinAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 2000);
  }, [joinAnim, joinStatus]);

  const handleCancelRequest = useCallback(() => {
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
    joinTimeoutRef.current = null;
    setJoinStatus('none');
    Animated.timing(joinAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [joinAnim]);

  useEffect(() => () => {
    if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current);
  }, []);

  const handleSendComment = useCallback(() => {
    if (!commentText.trim()) return;
    setComments(prev => [...prev, { id: `me-${Date.now()}`, user: 'You', text: commentText.trim(), isMe: true }]);
    setCommentText('');
    Keyboard.dismiss();
  }, [commentText]);

  const handleSendGift = useCallback((gift) => {
    if (coins < gift.coins) {
      setShowGiftSheet(false);
      setShowCoinSheet(true);
      return;
    }
    consumeCoins(gift.coins);
    setShowGiftSheet(false);
    spawnReaction(gift.emoji);
    setComments(prev => [...prev, { id: `gift-${Date.now()}`, user: 'You', text: `sent ${gift.emoji} ${gift.name}`, isMe: true }]);
    hapticSelection?.();
  }, [coins, consumeCoins, spawnReaction, navigation]);

  return (
    <View style={s.page}>
      {/* Background */}
      <Image source={{ uri: image }} style={s.bgImage} blurRadius={0} />
      <View style={[s.bgOverlay, joinStatus === 'joined' && { backgroundColor: 'rgba(0,0,0,0.3)' }]} />

      {/* Gradients — always visible for readability */}
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={s.topGradient} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={s.bottomGradient} pointerEvents="none" />

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        {/* Streamer chip — avatar + name + follow in one pill */}
        <View style={s.streamerChip}>
          <Image source={{ uri: avatar }} style={s.streamerAvatar} />
          <View style={s.streamerTextCol}>
            <Text style={s.streamerName} numberOfLines={1}>{userName || 'User'}</Text>
            <Animated.View style={[s.liveBadge, { transform: [{ scale: pulseAnim }] }]}>
              <View style={s.liveDot} />
              <Text style={s.liveLabel}>LIVE</Text>
            </Animated.View>
          </View>
          <TouchableOpacity
            style={[s.followPill, (isFollowing || isFriend) && s.followPillActive]}
            onPress={() => { toggleFollow(); hapticSelection?.(); }}
            activeOpacity={0.8}
          >
            <Text style={s.followPillText}>
              {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Right — viewers + close */}
        <View style={s.topRight}>
          <View style={s.viewerPill}>
            <Ionicons name="eye" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={s.viewerText}>{viewerCount}</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments, reactions, input — always visible */}
      <KeyboardAvoidingView
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {/* Floating reactions */}
        <View style={s.reactionsColumn} pointerEvents="none">
          {floatingReactions.map(r => (
            <Animated.Text
              key={r.id}
              style={[s.floatingEmoji, {
                opacity: r.anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 0.8, 0] }),
                transform: [
                  { translateY: r.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -220] }) },
                  { translateX: r.xOffset },
                  { scale: r.anim.interpolate({ inputRange: [0, 0.15, 0.4, 1], outputRange: [0.3, 1.4, 1, 0.7] }) },
                ],
              }]}
            >{r.emoji}</Animated.Text>
          ))}
        </View>

        {/* Comments */}
        <View style={[s.commentsArea, { bottom: insets.bottom + 64 }]}>
          <FlatList
            data={comments.slice(-6)}
            keyExtractor={c => c.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: c }) => (
              <Text style={s.commentLine} numberOfLines={2}>
                <Text style={[s.commentUser, c.isMe && s.commentUserMe]}>{c.user}  </Text>
                <Text style={s.commentMsg}>{c.text}</Text>
              </Text>
            )}
          />
        </View>

        {/* Bottom bar */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
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
                <Ionicons name="send" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <>
                {joinStatus === 'none' ? (
                  <TouchableOpacity style={s.joinBtn} onPress={handleRequestJoin} activeOpacity={0.8}>
                    <Ionicons name="hand-right" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : joinStatus === 'pending' ? (
                  <TouchableOpacity style={s.joinBtnPending} onPress={handleCancelRequest} activeOpacity={0.8}>
                    <Ionicons name="time" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : null}
                {REACTION_EMOJIS.slice(0, 3).map(emoji => (
                  <TouchableOpacity key={emoji} style={s.quickReaction} onPress={() => { spawnReaction(emoji); hapticSelection?.(); }}>
                    <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.giftBtn} onPress={() => setShowGiftSheet(true)}>
                  <Ionicons name="gift" size={18} color="#F97316" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Gift Sheet */}
      <Modal visible={showGiftSheet} transparent animationType="slide" onRequestClose={() => setShowGiftSheet(false)}>
        <Pressable style={s.giftOverlay} onPress={() => setShowGiftSheet(false)}>
          <View style={s.giftSheet} onStartShouldSetResponder={() => true}>
            <View style={s.giftSheetHeader}>
              <Text style={s.giftSheetTitle}>Send a Gift</Text>
              <View style={s.coinBadge}>
                <Ionicons name="wallet" size={14} color="#FCCD12" />
                <Text style={s.coinBadgeText}>{coins}</Text>
              </View>
            </View>
            <View style={s.giftGrid}>
              {GIFTS.map(gift => (
                <TouchableOpacity key={gift.id} style={s.giftItem} onPress={() => handleSendGift(gift)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 32, marginBottom: 6 }}>{gift.emoji}</Text>
                  <Text style={s.giftName}>{gift.name}</Text>
                  <View style={s.giftCost}>
                    <Ionicons name="ellipse" size={6} color="#FCCD12" />
                    <Text style={s.giftCostText}>{gift.coins}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.getCoinsBtn} onPress={() => { setShowGiftSheet(false); setShowCoinSheet(true); }}>
              <Text style={s.getCoinsBtnText}>Get More Coins</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <CoinPurchaseSheet visible={showCoinSheet} onClose={() => setShowCoinSheet(false)} />
    </View>
  );
}

// ── Main Screen — Vertical Pager ──
export default function LiveViewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const allLives = route.params?.allLives || (route.params?.liveData ? [route.params.liveData] : []);
  const initialIndex = route.params?.initialIndex || 0;
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const onViewRef = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  });
  const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

  const renderPage = useCallback(({ item, index }) => (
    <LiveStreamPage
      item={item}
      navigation={navigation}
      isActive={index === activeIndex}
      insets={insets}
    />
  ), [navigation, activeIndex, insets]);

  return (
    <FlatList
      data={allLives}
      keyExtractor={item => item.id}
      renderItem={renderPage}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, index) => ({ length: H, offset: H * index, index })}
      onViewableItemsChanged={onViewRef.current}
      viewabilityConfig={viewConfigRef.current}
      style={{ flex: 1, backgroundColor: '#000' }}
    />
  );
}

// ── Styles ──
const s = StyleSheet.create({
  page: { width: W, height: H, backgroundColor: '#000' },

  // Background
  bgImage: { ...StyleSheet.absoluteFillObject, width: W, height: H },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Pre-join center
  preJoinCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 40,
  },
  preJoinAvatar: {
    width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: '#CE1126', marginBottom: 16,
  },
  preJoinName: {
    fontSize: 24, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', marginBottom: 6,
  },
  preJoinCaption: {
    fontSize: 15, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.6)',
    textAlign: 'center', marginBottom: 12, lineHeight: 20,
  },
  preJoinViewers: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24,
  },
  preJoinViewerText: {
    fontSize: 15, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.7)',
  },
  preJoinHint: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 18,
  },
  requestBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#CE1126', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30,
  },
  requestBtnText: {
    fontSize: 17, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF', letterSpacing: 0.3,
  },
  pendingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pendingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  pendingText: {
    fontSize: 14, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.8)',
  },
  cancelRequestBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  cancelRequestText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.8)',
  },

  // Gradients
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, zIndex: 5 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, zIndex: 5 },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 10,
  },

  // Streamer chip — compact pill with avatar, name, live badge, follow
  streamerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 28,
    paddingLeft: 3, paddingRight: 4, paddingVertical: 3,
  },
  streamerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: '#CE1126',
  },
  streamerTextCol: {
    gap: 2,
  },
  streamerName: {
    fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF',
    maxWidth: 100,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    backgroundColor: '#CE1126', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4,
  },
  liveDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF' },
  liveLabel: { fontSize: 8, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', letterSpacing: 0.5 },

  followPill: {
    backgroundColor: '#CE1126', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    marginLeft: 2,
  },
  followPillActive: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
  },
  followPillText: { fontSize: 12, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },

  // Top right — viewers + close
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  viewerText: { fontSize: 12, fontWeight: '600', fontFamily: FontFamily.semibold, color: 'rgba(255,255,255,0.8)' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Floating reactions
  reactionsColumn: {
    position: 'absolute', right: 16, bottom: 200, width: 60, height: 250, zIndex: 15, alignItems: 'center',
  },
  floatingEmoji: { fontSize: 36, position: 'absolute', bottom: 0 },

  // Comments
  commentsArea: { position: 'absolute', left: 14, right: 70, zIndex: 15 },
  commentLine: {
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  commentUser: { fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold, color: 'rgba(255,255,255,0.6)' },
  commentUserMe: { color: '#FCCD12' },
  commentMsg: { fontSize: 14, fontFamily: FontFamily.regular, color: '#FFFFFF' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentInput: {
    flex: 1, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#FFF', paddingHorizontal: 16, paddingVertical: 11,
    fontSize: 15, fontFamily: FontFamily.regular,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#CE1126', justifyContent: 'center', alignItems: 'center' },
  joinBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#CE1126', justifyContent: 'center', alignItems: 'center' },
  joinBtnPending: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(206,17,38,0.5)', justifyContent: 'center', alignItems: 'center' },
  quickReaction: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  giftBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Gift Sheet
  giftOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  giftSheet: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
  },
  giftSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  giftSheetTitle: { fontSize: 19, fontWeight: '800', fontFamily: FontFamily.bold, color: '#FFF' },
  coinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(252,205,18,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  coinBadgeText: { fontSize: 14, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FCCD12' },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  giftItem: {
    width: (W - 80) / 3, alignItems: 'center', paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  giftName: { fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  giftCost: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  giftCostText: { fontSize: 12, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FCCD12' },
  getCoinsBtn: {
    marginTop: 16, alignItems: 'center', paddingVertical: 12, borderRadius: 20,
    backgroundColor: 'rgba(252,205,18,0.15)', borderWidth: 1, borderColor: 'rgba(252,205,18,0.3)',
  },
  getCoinsBtnText: { fontSize: 15, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FCCD12' },
});
