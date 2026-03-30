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
  Alert,
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

  // Auto comments
  useEffect(() => {
    if (!isActive || joinStatus !== 'joined') return;
    const interval = setInterval(() => {
      if (commentIdxRef.current < MOCK_COMMENTS.length) {
        const c = MOCK_COMMENTS[commentIdxRef.current];
        setComments(prev => [...prev, { ...c, id: `lv-${Date.now()}-${commentIdxRef.current}` }]);
        commentIdxRef.current++;
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [isActive, joinStatus]);

  // Auto reactions
  useEffect(() => {
    if (!isActive || joinStatus !== 'joined') return;
    const interval = setInterval(() => {
      spawnReaction(REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)]);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, joinStatus]);

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
  }, [commentText]);

  const handleSendGift = useCallback((gift) => {
    if (coins < gift.coins) {
      Alert.alert('Not Enough Coins', `You need ${gift.coins} coins.`, [
        { text: 'Get Coins', onPress: () => { setShowGiftSheet(false); navigation.navigate('Elite'); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
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

      {/* Center content when not joined */}
      {joinStatus !== 'joined' && (
        <View style={s.preJoinCenter}>
          <Image source={{ uri: image }} style={s.preJoinAvatar} />
          <Text style={s.preJoinName}>{userName}, {item.age}</Text>
          {title ? <Text style={s.preJoinCaption} numberOfLines={2}>{title}</Text> : null}
          <View style={s.preJoinViewers}>
            <Ionicons name="eye" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={s.preJoinViewerText}>{viewerCount} watching</Text>
          </View>
          <Text style={s.preJoinHint}>Request to join to chat, react, and send gifts.</Text>

          {joinStatus === 'none' && (
            <TouchableOpacity style={s.requestBtn} onPress={handleRequestJoin} activeOpacity={0.8}>
              <Ionicons name="hand-right" size={18} color="#FFFFFF" />
              <Text style={s.requestBtnText}>Request to Join</Text>
            </TouchableOpacity>
          )}
          {joinStatus === 'pending' && (
            <>
              <Animated.View style={[s.pendingPill, { opacity: joinAnim }]}>
                <Ionicons name="time" size={16} color="#FFFFFF" />
                <Text style={s.pendingText}>Waiting for host...</Text>
              </Animated.View>
              <TouchableOpacity style={s.cancelRequestBtn} onPress={handleCancelRequest} activeOpacity={0.8}>
                <Text style={s.cancelRequestText}>Cancel Request</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Gradients (when joined) */}
      {joinStatus === 'joined' && (
        <>
          <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={s.topGradient} pointerEvents="none" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={s.bottomGradient} pointerEvents="none" />
        </>
      )}

      {/* Top bar — always visible */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={s.topBarLeft}>
          <TouchableOpacity style={s.streamerInfo} activeOpacity={0.8}>
            <Image source={{ uri: avatar }} style={s.streamerAvatar} />
            <View>
              <Text style={s.streamerName}>{userName || 'User'}</Text>
              <View style={s.streamerMeta}>
                <Animated.View style={[s.liveBadge, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={s.liveDot} />
                  <Text style={s.liveLabel}>LIVE</Text>
                </Animated.View>
                <Text style={s.viewerText}>{viewerCount}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.followBtn, (isFollowing || isFriend) && s.followBtnActive]}
            onPress={() => { toggleFollow(); hapticSelection?.(); }}
          >
            <Text style={s.followBtnText}>
              {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Joined UI — comments, reactions, input */}
      {joinStatus === 'joined' && (
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
          <View style={[s.commentsArea, { bottom: insets.bottom + 70 }]}>
            <FlatList
              data={comments.slice(-8)}
              keyExtractor={c => c.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: c }) => (
                <View style={s.commentBubble}>
                  <Text style={[s.commentUser, c.isMe && s.commentUserMe]}>{c.user}</Text>
                  <Text style={s.commentText}>{c.text}</Text>
                </View>
              )}
            />
          </View>

          {/* Bottom input */}
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
              {REACTION_EMOJIS.slice(0, 3).map(emoji => (
                <TouchableOpacity key={emoji} style={s.quickReaction} onPress={() => { spawnReaction(emoji); hapticSelection?.(); }}>
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.giftBtn} onPress={() => setShowGiftSheet(true)}>
                <Ionicons name="gift" size={20} color="#F97316" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

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
            <TouchableOpacity style={s.getCoinsBtn} onPress={() => { setShowGiftSheet(false); navigation.navigate('Elite'); }}>
              <Text style={s.getCoinsBtnText}>Get More Coins</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  pendingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 12,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  streamerInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 24, paddingRight: 12, paddingVertical: 4, paddingLeft: 4,
  },
  streamerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#CE1126' },
  streamerName: { fontSize: 14, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },
  streamerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#CE1126', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#FFF' },
  liveLabel: { fontSize: 9, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', letterSpacing: 0.5 },
  viewerText: { fontSize: 12, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.6)' },

  followBtn: { backgroundColor: '#CE1126', paddingHorizontal: 15, paddingVertical: 7, borderRadius: 17 },
  followBtnActive: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  followBtnText: { fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },

  closeBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  // Floating reactions
  reactionsColumn: {
    position: 'absolute', right: 16, bottom: 200, width: 60, height: 250, zIndex: 15, alignItems: 'center',
  },
  floatingEmoji: { fontSize: 36, position: 'absolute', bottom: 0 },

  // Comments
  commentsArea: { position: 'absolute', left: 12, right: 80, height: 200, zIndex: 15 },
  commentBubble: {
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7,
    marginBottom: 6, alignSelf: 'flex-start', maxWidth: '90%',
  },
  commentUser: { fontSize: 12, fontWeight: '700', fontFamily: FontFamily.bold, color: '#F97316', marginBottom: 1 },
  commentUserMe: { color: '#CE1126' },
  commentText: { fontSize: 14, fontFamily: FontFamily.regular, color: '#FFF', lineHeight: 19 },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)', color: '#FFF', paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, fontFamily: FontFamily.regular,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#CE1126', justifyContent: 'center', alignItems: 'center' },
  quickReaction: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  giftBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
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
