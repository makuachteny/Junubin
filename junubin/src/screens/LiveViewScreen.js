// AnaJunubin — Live View Screen (TikTok-style scrollable live streams)
// Full-screen paginated vertical scroll with request-to-join, comments, reactions, gifting
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  FlatList,
  Image,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { hapticSelection } from '../utils/haptics';
import { useAuth, useRequireAuth } from '../auth';
import { useSubscription } from '../payments';
import CoinPurchaseSheet from '../components/CoinPurchaseSheet';
import { useLiveChannel } from '../api/hooks/useLiveChannel';
import { useDailyCall } from '../api/hooks/useDailyCall';
import { getOrCreateDailyRoom } from '../api/services/dailyService';
import * as liveService from '../api/services/liveService';
import * as liveGiftsService from '../api/services/liveGiftsService';
import { supabase } from '../config/supabase';
import { DailyMediaView } from '@daily-co/react-native-daily-js';

const { width: W, height: H } = Dimensions.get('window');

// Single emoji list — used for auto-reactions and the emoji picker
const EMOJIS = ['❤️', '🔥', '😂', '😍', '👏', '🙏', '💯', '😭', '🎉', '💫', '😱', '🥺'];
const GIFTS = [
  { id: 'rose', emoji: '🌹', name: 'Rose', cost: 1 },
  { id: 'heart', emoji: '💖', name: 'Heart', cost: 5 },
  { id: 'star', emoji: '⭐', name: 'Star', cost: 10 },
  { id: 'fire', emoji: '🔥', name: 'Fire', cost: 20 },
  { id: 'diamond', emoji: '💎', name: 'Diamond', cost: 50 },
  { id: 'crown', emoji: '👑', name: 'Crown', cost: 100 },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', cost: 200 },
  { id: 'lion', emoji: '🦁', name: 'Lion', cost: 500 },
  { id: 'trophy', emoji: '🏆', name: 'Trophy', cost: 1000 },
];

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
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const { coins, consumeCoins } = useSubscription();
  const myDisplayName = user?.displayName || user?.profile?.displayName || 'You';

  const [viewerCount, setViewerCount] = useState(initialViewers);
  const [isWatching, setIsWatching] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(MOCK_COMMENTS.slice(0, 3));
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [joinStatus, setJoinStatus] = useState('none'); // none | pending | joined
  const [activeTab, setActiveTab] = useState('For You');
  const [showGiftSheet, setShowGiftSheet] = useState(false);
  const [showCoinSheet, setShowCoinSheet] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // TikTok-style gift events. Each entry is { id, sender, gift, count, anim }.
  // When the same sender sends the same gift again within ~3s, we bump the
  // count on the existing entry instead of stacking a fresh banner.
  const [giftEvents, setGiftEvents] = useState([]);
  const giftEventIdRef = useRef(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const joinAnim = useRef(new Animated.Value(0)).current;
  const joinTimeoutRef = useRef(null);
  const reactionIdRef = useRef(0);
  const commentIdxRef = useRef(0);
  const commentsListRef = useRef(null);
  const commentIdRef = useRef(0);

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

  // Auto reactions — always visible
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      spawnReaction(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
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

  const joinRequestRef = useRef(null);
  const joinSubRef = useRef(null);

  const handleRequestJoin = useCallback(async () => {
    if (joinStatus === 'pending' || joinStatus === 'joined') return;
    if (!item.id) return;
    setJoinStatus('pending');
    hapticSelection?.();
    Animated.timing(joinAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    try {
      const reqRow = await liveService.requestJoin(item.id);
      joinRequestRef.current = reqRow;
      // Host writes the row's status to accepted/declined; the realtime
      // subscription is what flips our local UI.
      joinSubRef.current = liveService.subscribeToRequest(reqRow.id, (next) => {
        if (!next) return;
        if (next.status === 'accepted') {
          setJoinStatus('joined');
          Animated.timing(joinAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
        } else if (next.status === 'declined' || next.status === 'expired') {
          setJoinStatus('none');
          Animated.timing(joinAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
        }
      });
    } catch {
      // If the request couldn't be persisted (network, no auth, etc.),
      // back out to the idle state rather than leaving the viewer stuck
      // on a "Pending" pill that will never resolve.
      setJoinStatus('none');
      Animated.timing(joinAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [item.id, joinAnim, joinStatus]);

  const handleCancelRequest = useCallback(() => {
    const req = joinRequestRef.current;
    setJoinStatus('none');
    Animated.timing(joinAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    if (joinSubRef.current) {
      try { supabase.removeChannel(joinSubRef.current); } catch {}
      joinSubRef.current = null;
    }
    if (req?.id) {
      liveService.cancelRequest(req.id).catch(() => {});
    }
    joinRequestRef.current = null;
  }, [joinAnim]);

  useEffect(() => () => {
    if (joinSubRef.current) {
      try { supabase.removeChannel(joinSubRef.current); } catch {}
      joinSubRef.current = null;
    }
  }, []);

  // Stream mock comments in to simulate other viewers
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const next = MOCK_COMMENTS[commentIdxRef.current % MOCK_COMMENTS.length];
      commentIdxRef.current += 1;
      setComments((prev) => {
        const id = `mock-${commentIdRef.current++}`;
        const trimmed = [...prev, { ...next, id, mine: false }];
        return trimmed.length > 30 ? trimmed.slice(-30) : trimmed;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [isActive]);

  // Append (or coalesce) a TikTok-style named gift banner. Same sender +
  // same gift within ~3s bumps the count instead of stacking a new row.
  const pushGiftEvent = useCallback((sender, gift) => {
    const now = Date.now();
    setGiftEvents((prev) => {
      const recent = prev[0];
      if (
        recent
        && recent.sender === sender
        && recent.gift.id === gift.id
        && now - recent.ts < 3000
      ) {
        return [
          { ...recent, count: recent.count + 1, ts: now },
          ...prev.slice(1),
        ];
      }
      const id = `gev-${giftEventIdRef.current++}`;
      const anim = new Animated.Value(0);
      // Slide in fast, hold, fade out — auto-prune when the fade ends.
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(anim, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start(() => {
        setGiftEvents((p) => p.filter((e) => e.id !== id));
      });
      return [
        { id, sender, gift, count: 1, ts: now, anim },
        ...prev.slice(0, 4),
      ];
    });
  }, []);

  // Daily room is provisioned only when the viewer actually taps to watch
  // (so background streams don't burn paid minutes / bandwidth on rooms
  // nobody is consuming).
  const [dailyRoom, setDailyRoom] = useState(null);
  useEffect(() => {
    if (!isWatching || !item.id) return;
    let cancelled = false;
    getOrCreateDailyRoom({ kind: 'live', context: item.id, isOwner: false })
      .then((room) => { if (!cancelled) setDailyRoom(room); })
      .catch(() => {
        // Daily.co not configured yet — fall back to the static-image
        // preview so the social layer (comments / gifts) still works.
      });
    return () => { cancelled = true; };
  }, [isWatching, item.id]);

  const dailyView = useDailyCall({
    roomUrl: dailyRoom?.url,
    token: dailyRoom?.token,
    role: 'listener', // viewer joins muted, no camera
    enabled: isWatching && !!dailyRoom,
  });
  const hostParticipant = dailyView.remotes[0];

  // Realtime channel keyed by host id (`item.id` is the streamer's user id).
  const liveChannel = useLiveChannel(item.id, {
    onComment: (c) => {
      // Comments from OTHER viewers — append to the floating list.
      const id = c.id || `liv-${c.ts}`;
      setComments((prev) => {
        const next = [...prev, { id, user: c.name || 'Viewer', text: c.text || '' }];
        return next.length > 30 ? next.slice(-30) : next;
      });
    },
    onReaction: ({ emoji }) => spawnReaction(emoji),
    onGift: ({ sender, gift, count }) => pushGiftEvent(sender, gift),
  });

  const handleSendGift = useCallback((gift) => {
    if (!isWatching) return;
    if (!requireAuth('Sign in to send gifts on JuNubin lives.')) return;
    if (coins < gift.cost) {
      setShowGiftSheet(false);
      setShowCoinSheet(true);
      return;
    }
    const consumed = consumeCoins(gift.cost);
    if (!consumed) {
      setShowGiftSheet(false);
      setShowCoinSheet(true);
      return;
    }
    hapticSelection?.();
    spawnReaction(gift.emoji);
    pushGiftEvent(myDisplayName, gift);
    // Broadcast to the host so their earnings counter ticks up + the
    // gift banner appears for them too.
    liveChannel.sendGift({ sender: myDisplayName, gift, count: 1 });
    // Persist to the LiveGiftEvent ledger so the host's
    // totalGiftCoinsReceived stays authoritative across sessions. Fire-
    // and-forget — the floating animation shouldn't wait on the
    // round-trip, and RLS will silently reject anything off-pattern
    // (mirrors GoLiveScreen / ChatScreen's pattern).
    if (item.id && gift?.id && gift?.cost > 0) {
      liveGiftsService
        .recordLiveGift({
          hostUserId: item.id,
          giftType: gift.id,
          coinAmount: gift.cost,
          context: 'live',
        })
        .catch(() => {});
    }
    // Keep the sheet open so the sender can chain gifts (TikTok pattern).
  }, [isWatching, requireAuth, coins, consumeCoins, spawnReaction, pushGiftEvent, myDisplayName, liveChannel, item.id]);

  // Mock incoming gifts from other viewers so the banner overlay shows
  // life — also gives the broadcaster's earnings counter content during
  // testing. Disabled when the host isn't being watched.
  useEffect(() => {
    if (!isActive || !isWatching) return;
    const senders = ['Akuol', 'Nyajima', 'Chan', 'Adut', 'Garang', 'Nyandeng'];
    const interval = setInterval(() => {
      if (Math.random() > 0.55) return;
      const r = Math.random();
      const tier = r < 0.6 ? 0 : r < 0.88 ? 1 : r < 0.97 ? 2 : 3;
      const pool = tier === 0 ? GIFTS.slice(0, 3)
        : tier === 1 ? GIFTS.slice(3, 5)
        : tier === 2 ? GIFTS.slice(5, 7)
        : GIFTS.slice(7);
      const gift = pool[Math.floor(Math.random() * pool.length)];
      const sender = senders[Math.floor(Math.random() * senders.length)];
      spawnReaction(gift.emoji);
      pushGiftEvent(sender, gift);
    }, 5500);
    return () => clearInterval(interval);
  }, [isActive, isWatching, spawnReaction, pushGiftEvent]);

  const sendComment = useCallback(() => {
    const text = commentText.trim();
    if (!text) return;
    if (!requireAuth('Sign in to chat in live streams.')) return;
    hapticSelection?.();
    const id = `me-${commentIdRef.current++}`;
    setComments((prev) => [...prev, { id, user: myDisplayName, text, mine: true }]);
    setCommentText('');
    // Broadcast to host + other viewers in real time.
    liveChannel.sendComment({ id, name: myDisplayName, text });
  }, [commentText, requireAuth, myDisplayName, liveChannel]);

  const TOP_TABS = ['Following', 'For You'];

  return (
    <View style={s.page}>
      {/* Background */}
      {/* Host's live video full-bleed once the Daily room is up and the
          host is publishing. Falls back to the still preview image when
          we're still waiting for media OR the host hasn't enabled their
          camera yet. */}
      {hostParticipant?.videoTrack ? (
        <DailyMediaView
          videoTrack={hostParticipant.videoTrack}
          audioTrack={hostParticipant.audioTrack}
          zOrder={0}
          mirror={false}
          style={s.bgImage}
        />
      ) : (
        <Image source={{ uri: image }} style={s.bgImage} blurRadius={0} />
      )}
      <View style={[s.bgOverlay, isWatching && { backgroundColor: 'rgba(0,0,0,0.25)' }, joinStatus === 'joined' && { backgroundColor: 'rgba(0,0,0,0.2)' }]} />

      {/* Gradients */}
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent']} style={s.topGradient} pointerEvents="none" />
      <LinearGradient colors={['transparent', isWatching ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.78)']} style={s.bottomGradient} pointerEvents="none" />
      <LinearGradient colors={['rgba(206,17,38,0.18)', 'transparent']} style={s.brandGlow} pointerEvents="none" />

      {/* Top bar */}
      <View style={[s.topBar, { paddingTop: insets.top + 2 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.modePill}>
          {TOP_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <TouchableOpacity
                key={tab}
                style={[s.modeChip, isActive && s.modeChipActive]}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[s.modeText, isActive && s.modeTextActive]}>{tab}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.topRightRow}>
          <View style={s.viewerPillHeader}>
            <Ionicons name="eye" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={s.viewerHeaderText}>{viewerCount}</Text>
          </View>
        </View>
      </View>

      {/* Reactions + overlays */}
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

        {/* TikTok-style gift banners — slide in from the left, sit just
            above the comments list. Same sender + same gift in a 3s
            window coalesces into a "×N" multiplier rather than stacking
            a fresh row, matching TikTok's visual language. */}
        <View style={[s.giftBanners, { bottom: insets.bottom + 280 }]} pointerEvents="none">
          {giftEvents.map((g) => (
            <Animated.View
              key={g.id}
              style={[
                s.giftBanner,
                {
                  opacity: g.anim,
                  transform: [{
                    translateX: g.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-220, 0],
                    }),
                  }],
                },
              ]}
            >
              <Text style={s.giftBannerEmoji}>{g.gift.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.giftBannerSender} numberOfLines={1}>{g.sender}</Text>
                <Text style={s.giftBannerKind} numberOfLines={1}>sent {g.gift.name}</Text>
              </View>
              {g.count > 1 ? (
                <Text style={s.giftBannerMultiplier}>×{g.count}</Text>
              ) : null}
            </Animated.View>
          ))}
        </View>

        {/* Live comments list — pushed down a touch so the gift banners
            above can breathe without crowding the chat. */}
        <View
          style={[s.commentsArea, { bottom: insets.bottom + 50, height: 220 }]}
          pointerEvents="box-none"
        >
          <FlatList
            ref={commentsListRef}
            data={comments}
            keyExtractor={(c) => c.id}
            renderItem={({ item: c }) => (
              <Text style={s.commentLine} numberOfLines={2}>
                <Text style={[s.commentUser, c.mine && s.commentUserMe]}>{c.user}: </Text>
                <Text style={s.commentMsg}>{c.text}</Text>
              </Text>
            )}
            onContentSizeChange={() => commentsListRef.current?.scrollToEnd?.({ animated: true })}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            inverted={false}
          />
        </View>

        {/* Right side actions (only visible after tap to watch) */}
        <View style={[s.rightStack, !isWatching && { opacity: 0.4 }]} pointerEvents={isWatching ? 'auto' : 'none'}>
          <TouchableOpacity
            style={[s.requestCard, joinStatus === 'pending' && s.requestCardPending, joinStatus === 'joined' && s.requestCardJoined]}
            activeOpacity={0.85}
            disabled={joinStatus === 'joined'}
            onPress={joinStatus === 'pending' ? handleCancelRequest : handleRequestJoin}
          >
            {joinStatus === 'pending' ? (
              <>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                <Text style={s.requestText}>Pending</Text>
              </>
            ) : joinStatus === 'joined' ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                <Text style={s.requestText}>Joined</Text>
              </>
            ) : (
              <>
                <Text style={s.requestPlus}>+</Text>
                <Text style={s.requestText}>Request</Text>
              </>
            )}
          </TouchableOpacity>
          {[0, 1].map((idx) => (
            <View key={idx} style={s.previewCard}>
              <View style={s.previewBadge}>
                <Text style={s.previewBadgeText}>2</Text>
              </View>
              <View style={s.previewAvatarWrap}>
                <Image source={{ uri: avatar }} style={s.previewAvatar} />
              </View>
              <Text style={s.previewName} numberOfLines={1}>TrAdItIoNaL...</Text>
            </View>
          ))}
        </View>

        <View style={[s.liveMeta, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.liveTopRow}>
            <View style={s.liveTag}>
              <View style={s.liveDotPulse} />
              <Text style={s.liveNowText}>LIVE</Text>
            </View>
          </View>
          <Text style={s.liveUser}>{userName || 'Akuch'}</Text>
          <Text style={s.liveFlags}>🇸🇸 🇰🇪 🇬🇧 🇺🇸</Text>
          <View style={s.locationRow}>
            <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.8)" />
            <Text style={s.liveCaption} numberOfLines={1}>{title || 'Q&A night'}</Text>
          </View>
        </View>

        {/* Tap to watch prompt — positioned above the bottom bar */}
        {!isWatching && (
          <Pressable style={[s.tapPromptSolo, { bottom: insets.bottom + 70 }]} onPress={() => setIsWatching(true)}>
            <Text style={s.tapInlineText}>Tap to watch LIVE</Text>
          </Pressable>
        )}

        {/* Bottom bar — always visible, only interactive after tap to watch */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 10 }]} pointerEvents={isWatching ? 'auto' : 'none'}>
          {/* Emoji picker popup — slides up above the bar */}
          {showEmojiPicker && (
            <View style={s.emojiPopup}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={s.emojiBtn}
                  onPress={() => {
                    hapticSelection?.();
                    spawnReaction(emoji);
                    liveChannel.sendReaction({ emoji });
                    setShowEmojiPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.emojiBtnText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={[s.inputRow, !isWatching && { opacity: 0.4 }]}>
            <View style={s.inputPill}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="rgba(255,255,255,0.6)" />
              <TextInput
                style={s.commentInput}
                placeholder="Say something..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={commentText}
                onChangeText={setCommentText}
                maxLength={120}
                returnKeyType="send"
                editable={isWatching}
                onSubmitEditing={sendComment}
              />
            </View>
            <TouchableOpacity
              style={[s.reactionBtn, showEmojiPicker && s.reactionBtnActive]}
              onPress={() => { hapticSelection?.(); setShowEmojiPicker((p) => !p); }}
              disabled={!isWatching}
            >
              <Ionicons name="happy-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.giftBtn} onPress={() => { hapticSelection?.(); setShowGiftSheet(true); }} disabled={!isWatching}>
              <Ionicons name="gift" size={18} color="#FCCD12" />
            </TouchableOpacity>
            <TouchableOpacity
              testID="live-send-comment"
              style={[s.sendBtn, !commentText.trim() && s.sendBtnDisabled]}
              onPress={sendComment}
              disabled={!isWatching || !commentText.trim()}
            >
              <Ionicons name="send" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Gift Sheet Modal */}
      <Modal
        visible={showGiftSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGiftSheet(false)}
      >
        <View style={s.giftOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowGiftSheet(false)} />
          <View style={s.giftSheet}>
            <View style={s.giftSheetHeader}>
              <Text style={s.giftSheetTitle}>Send a Gift</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={s.coinBadge}>
                  <Ionicons name="flash" size={13} color="#FCCD12" />
                  <Text style={s.coinBadgeText}>{coins.toLocaleString()}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowGiftSheet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.giftGrid}>
              {GIFTS.map((gift) => {
                const canAfford = coins >= gift.cost;
                return (
                  <TouchableOpacity
                    key={gift.id}
                    style={[s.giftItem, !canAfford && s.giftItemDim]}
                    activeOpacity={0.7}
                    onPress={() => handleSendGift(gift)}
                  >
                    <Text style={{ fontSize: 32 }}>{gift.emoji}</Text>
                    <Text style={s.giftName}>{gift.name}</Text>
                    <View style={s.giftCost}>
                      <Ionicons name="flash" size={11} color={canAfford ? '#FCCD12' : 'rgba(252,205,18,0.5)'} />
                      <Text style={[s.giftCostText, !canAfford && { color: 'rgba(252,205,18,0.5)' }]}>{gift.cost}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={s.getCoinsBtn}
              activeOpacity={0.8}
              onPress={() => {
                setShowGiftSheet(false);
                setShowCoinSheet(true);
              }}
            >
              <Text style={s.getCoinsBtnText}>Get More Coins</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  brandGlow: {
    position: 'absolute',
    top: 0,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    zIndex: 4,
  },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeChipActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.5)',
  },
  modeTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  topRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewerPillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  viewerHeaderText: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  searchBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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

  playRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tapText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.85)',
  },

  // Right stack
  rightStack: {
    position: 'absolute',
    right: 14,
    bottom: 110,
    alignItems: 'center',
    gap: 10,
    zIndex: 16,
  },
  requestCard: {
    width: 70,
    height: 86,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  requestCardPending: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  requestCardJoined: {
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  requestPlus: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  requestText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: '#FFFFFF',
  },
  previewCard: {
    width: 70,
    height: 86,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  previewBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  previewBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  previewAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    marginBottom: 6,
  },
  previewAvatar: { width: '100%', height: '100%' },
  previewName: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
  },

  // Bottom live meta
  liveMeta: {
    position: 'absolute',
    left: 14,
    right: 120,
    bottom: 70,
    zIndex: 16,
  },
  tapPromptSolo: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    marginHorizontal: 64,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 25,
  },
  liveTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  viewerPillAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CE1126',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveDotPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveNowText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  liveUser: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  liveFlags: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  liveCaption: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveCenterPrompt: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  tapInlineText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.8)',
  },

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
  // Emoji popup + reaction button
  emojiPopup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 10,
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnText: {
    fontSize: 22,
  },
  reactionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  commentInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontFamily: FontFamily.regular,
    paddingVertical: 0,
  },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#CE1126', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  joinBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#CE1126', justifyContent: 'center', alignItems: 'center' },
  joinBtnPending: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(206,17,38,0.5)', justifyContent: 'center', alignItems: 'center' },
  quickReaction: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  giftBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252,205,18,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Gift Sheet — tall bottom sheet
  giftOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  giftSheet: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    minHeight: '70%',
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
  giftItemDim: {
    opacity: 0.42,
  },

  // TikTok-style named gift banners
  giftBanners: {
    position: 'absolute',
    left: 12,
    right: 80,
    zIndex: 16,
    gap: 6,
  },
  giftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(252,205,18,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    maxWidth: '95%',
  },
  giftBannerEmoji: { fontSize: 26 },
  giftBannerSender: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  giftBannerKind: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  giftBannerMultiplier: {
    fontSize: 18,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    color: '#FCCD12',
    letterSpacing: -0.5,
    marginLeft: 6,
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
