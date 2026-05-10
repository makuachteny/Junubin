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
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, useTheme } from '../theme';
import { hapticSelection } from '../utils/haptics';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import { useLiveChannel } from '../api/hooks/useLiveChannel';
import { useDailyCall } from '../api/hooks/useDailyCall';
import { getOrCreateDailyRoom } from '../api/services/dailyService';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import * as liveService from '../api/services/liveService';
import * as liveGiftsService from '../api/services/liveGiftsService';
import * as payoutsService from '../api/services/payoutsService';
import { supabase } from '../config/supabase';

const { width: W, height: H } = Dimensions.get('window');

// Mock live comments for development
const MOCK_COMMENTS = [
  { id: '1', user: 'Akuol', text: 'You look amazing! \u{1F525}', time: Date.now() - 30000 },
  { id: '2', user: 'Nyajima', text: 'Where are you rn?', time: Date.now() - 25000 },
  { id: '3', user: 'Chan', text: 'YESSSS \u{2728}\u{2728}', time: Date.now() - 15000 },
  { id: '4', user: 'Adut', text: 'This is fire', time: Date.now() - 8000 },
];

const REACTION_EMOJIS = ['\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F60D}', '\u{1F64F}', '\u{1F389}', '\u{1F4AB}'];

// Same gift catalog the viewer (LiveViewScreen) sends from. Broadcaster
// receives these and earns the cost in coins; coins → cash payout at the
// platform's cash-out rate (configured later — for now we surface the
// running total so the host knows what's coming in).
const GIFTS = [
  { id: 'rose', emoji: '\u{1F339}', name: 'Rose', cost: 1 },
  { id: 'heart', emoji: '\u{1F496}', name: 'Heart', cost: 5 },
  { id: 'star', emoji: '\u{2B50}', name: 'Star', cost: 10 },
  { id: 'fire', emoji: '\u{1F525}', name: 'Fire', cost: 20 },
  { id: 'diamond', emoji: '\u{1F48E}', name: 'Diamond', cost: 50 },
  { id: 'crown', emoji: '\u{1F451}', name: 'Crown', cost: 100 },
  { id: 'rocket', emoji: '\u{1F680}', name: 'Rocket', cost: 200 },
  { id: 'lion', emoji: '\u{1F981}', name: 'Lion', cost: 500 },
  { id: 'trophy', emoji: '\u{1F3C6}', name: 'Trophy', cost: 1000 },
];

// 100 coins ≈ $1 USD payout. Surface this in the host's earnings sheet so
// they understand what the running coin count converts to.
const COINS_PER_USD = 100;

// Minimum coin balance required to submit a payout request. ~$10 USD
// at the COINS_PER_USD rate above. Submit button is disabled and a
// hint is shown below this threshold so creators know what to aim for.
const PAYOUT_MIN_COINS = 1000;

// Payout method options surfaced in the cash-out sheet. The `key`
// matches the migration's CHECK constraint (00021_payout_requests.sql).
const PAYOUT_METHODS = [
  { key: 'stripe_connect', label: 'Stripe (international)', placeholder: 'Email tied to Stripe account', icon: 'card' },
  { key: 'mobile_money',  label: 'M-Pesa / MTN MoMo',     placeholder: 'Phone number (e.g. +254712345678)', icon: 'phone-portrait' },
  { key: 'bank_transfer', label: 'Bank transfer',         placeholder: 'IBAN or account number', icon: 'business' },
];

export default function GoLiveScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  // Live broadcasts need audio. Without this, iOS streams go out
  // silently with no permission prompt at all.
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState('front');
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [duration, setDuration] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [title, setTitle] = useState('');
  const [showPreLive, setShowPreLive] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showEarningsSheet, setShowEarningsSheet] = useState(false);
  // Total coins received from gift senders this session. Reset on stream
  // start; persisted server-side once payments backend lands.
  const [totalCoins, setTotalCoins] = useState(0);
  const [recentGifts, setRecentGifts] = useState([]);
  const [giftEvents, setGiftEvents] = useState([]);

  // Lifetime balance from the User row (totalGiftCoinsReceived) — what
  // the cash-out sheet operates on. Distinct from `totalCoins` which is
  // the per-session counter for the floating UI. Loaded on mount and
  // refreshed after a successful payout request so the displayed
  // balance reflects the post-debit value.
  const [lifetimeCoins, setLifetimeCoins] = useState(0);
  const [showCashOutSheet, setShowCashOutSheet] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('stripe_connect');
  const [payoutDestination, setPayoutDestination] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState(null);
  const [myPayoutRequests, setMyPayoutRequests] = useState([]);
  const [payoutSuccessId, setPayoutSuccessId] = useState(null);
  // Stripe Connect onboarding state — populated from getMyConnectStatus
  // whenever the cash-out sheet opens. When `payoutsEnabled` is false
  // and the user picks the Stripe method, we replace the destination
  // input + submit button with a "Set up Stripe payouts" CTA.
  const [connectStatus, setConnectStatus] = useState({
    accountId: null,
    chargesEnabled: false,
    payoutsEnabled: false,
  });
  const [connectStarting, setConnectStarting] = useState(false);

  // Host's own id is the streamId — viewers tune to `live:<userId>`.
  const { user } = useAuth();
  const { currentUser } = useCurrentUser();
  const streamId = user?.id || currentUser?.id;

  // Subscribe so the host sees viewer-side comments/reactions/gifts in
  // their own UI in real time (the simulator stays as a fallback so
  // testing without a viewer still feels alive).
  const liveChannel = useLiveChannel(streamId, {
    onComment: (c) => {
      setComments((prev) => [...prev, {
        id: c.id || `liv-${c.ts}`,
        user: c.name || 'Viewer',
        text: c.text || '',
        time: c.ts || Date.now(),
        isMe: false,
      }]);
    },
    onReaction: ({ emoji }) => {
      const id = `r-${reactionIdRef.current++}`;
      const anim = new Animated.Value(0);
      setFloatingReactions((prev) => [...prev.slice(-8), { id, emoji, anim }]);
      Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }).start(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      });
    },
    onGift: ({ sender, gift, count }) => {
      // Real viewer gifts merge with the simulated stream of mock ones.
      const totalCoinDelta = (gift?.cost || 0) * (count || 1);
      setTotalCoins((c) => c + totalCoinDelta);
      // NOTE: Persistence to LiveGiftEvent happens on the *viewer's*
      // side (LiveViewScreen.handleSendGift) because the RLS INSERT
      // policy keys on auth.uid() = giverUserId. Recording here would
      // double-count: the host's auth.uid matches host.id, so an
      // insert from the host produces a {host=H, giver=H} self-row
      // whose trigger ALSO bumps totalGiftCoinsReceived. The local
      // setTotalCoins bump above is purely a UI counter — the
      // server-of-record is the row the viewer wrote.
      setRecentGifts((prev) => [
        { id: `gf-${Date.now()}`, gift, sender, ts: Date.now() },
        ...prev.slice(0, 19),
      ]);
      setGiftEvents((prev) => {
        const id = `gev-${Date.now()}`;
        const bannerAnim = new Animated.Value(0);
        Animated.sequence([
          Animated.timing(bannerAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.delay(2600),
          Animated.timing(bannerAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]).start(() => {
          setGiftEvents((p) => p.filter((e) => e.id !== id));
        });
        return [{ id, sender, gift, count: count || 1, ts: Date.now(), anim: bannerAnim }, ...prev.slice(0, 4)];
      });
    },
  });

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

  // Simulate viewers sending gifts. Lower-tier gifts arrive more often;
  // jackpot gifts (Crown, Rocket, Lion, Trophy) are rare. Each gift fires
  // a floating animation AND credits the host's coin balance, so the
  // counter at the top reflects real-time earnings.
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const r = Math.random();
      const tier = r < 0.55 ? 0 : r < 0.85 ? 1 : r < 0.96 ? 2 : 3;
      const pool = tier === 0 ? GIFTS.slice(0, 3)
        : tier === 1 ? GIFTS.slice(3, 5)
        : tier === 2 ? GIFTS.slice(5, 7)
        : GIFTS.slice(7);
      const gift = pool[Math.floor(Math.random() * pool.length)];
      const senderPool = ['Akuol', 'Nyajima', 'Chan', 'Adut', 'Garang', 'Nyandeng', 'Abuk', 'Deng'];
      const sender = senderPool[Math.floor(Math.random() * senderPool.length)];

      // Float the gift emoji like a reaction.
      const id = `g-${reactionIdRef.current++}`;
      const anim = new Animated.Value(0);
      setFloatingReactions((prev) => [...prev.slice(-8), { id, emoji: gift.emoji, anim }]);
      Animated.timing(anim, { toValue: 1, duration: 2400, useNativeDriver: true }).start(() => {
        setFloatingReactions((prev) => prev.filter((r2) => r2.id !== id));
      });

      // Credit + log.
      setTotalCoins((c) => c + gift.cost);
      // NOTE: No recordLiveGift call here either — see the matching
      // comment in the `onGift` callback above. The mock simulator is
      // a UI-only path; in production the viewer's LiveViewScreen
      // writes the LiveGiftEvent row.
      setRecentGifts((prev) => [
        { id, gift, sender, ts: Date.now() },
        ...prev.slice(0, 19),
      ]);

      // Push a named TikTok-style banner; coalesce same sender + same gift
      // within 3s into a multiplier instead of stacking new rows.
      setGiftEvents((prev) => {
        const recent = prev[0];
        const now = Date.now();
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
        const bannerId = `gev-${reactionIdRef.current++}`;
        const bannerAnim = new Animated.Value(0);
        Animated.sequence([
          Animated.timing(bannerAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.delay(2600),
          Animated.timing(bannerAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
        ]).start(() => {
          setGiftEvents((p) => p.filter((e) => e.id !== bannerId));
        });
        return [
          { id: bannerId, sender, gift, count: 1, ts: now, anim: bannerAnim },
          ...prev.slice(0, 4),
        ];
      });
    }, 7000);
    return () => clearInterval(interval);
  }, [isLive]);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const [dailyRoom, setDailyRoom] = useState(null);
  const [dailyError, setDailyError] = useState(null);

  // Pending join requests from viewers — keyed by requestId so realtime
  // updates collapse onto the existing entry rather than duplicating.
  const [joinRequests, setJoinRequests] = useState([]);

  useEffect(() => {
    if (!isLive || !streamId) return undefined;
    const channel = liveService.subscribeToHostRequests(streamId, async (row) => {
      if (!row) return;
      // Only surface pending requests in the tray; accepted/declined/expired
      // disappear so the host's UI doesn't need a second sweep.
      if (row.status === 'pending') {
        const { data: viewer } = await supabase
          .from('User')
          .select('id, displayName, photos:Photo(url)')
          .eq('id', row.viewerId)
          .maybeSingle();
        setJoinRequests((prev) => {
          if (prev.some((r) => r.id === row.id)) return prev;
          return [...prev, { ...row, viewer }];
        });
      } else {
        setJoinRequests((prev) => prev.filter((r) => r.id !== row.id));
      }
    });
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [isLive, streamId]);

  const handleAcceptJoinRequest = useCallback((req) => {
    liveService.respondToRequest(req.id, 'accepted').catch(() => {});
    setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
  }, []);

  const handleDeclineJoinRequest = useCallback((req) => {
    liveService.respondToRequest(req.id, 'declined').catch(() => {});
    setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
  }, []);

  const handleGoLive = useCallback(async () => {
    setShowPreLive(false);
    setIsLive(true);
    setViewerCount(1);
    Animated.spring(liveBadgeAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
    hapticSelection?.();
    if (!streamId) return;
    try {
      const room = await getOrCreateDailyRoom({ kind: 'live', context: streamId, isOwner: true });
      setDailyRoom(room);
    } catch (e) {
      setDailyError(e?.message || 'Could not start broadcast');
    }
  }, [liveBadgeAnim, streamId]);

  // Host joins their own Daily room as the broadcaster — full audio +
  // video publish. Viewers tune to the same room as listeners (see
  // LiveViewScreen). Daily handles SFU, recording, scaling.
  const dailyBroadcast = useDailyCall({
    roomUrl: dailyRoom?.url,
    token: dailyRoom?.token,
    role: 'host',
    enabled: isLive && !!dailyRoom,
  });

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

  const earnedUsd = useMemo(() => (totalCoins / COINS_PER_USD).toFixed(2), [totalCoins]);
  const lifetimeUsd = useMemo(() => (lifetimeCoins / COINS_PER_USD).toFixed(2), [lifetimeCoins]);
  const meetsPayoutThreshold = lifetimeCoins >= PAYOUT_MIN_COINS;
  const selectedMethodMeta = useMemo(
    () => PAYOUT_METHODS.find((m) => m.key === payoutMethod) || PAYOUT_METHODS[0],
    [payoutMethod],
  );

  // Load lifetime earnings + payout history whenever the cash-out
  // sheet opens. Cheap (two single-row reads) and ensures a fresh
  // balance after a payout request was submitted on another device.
  const refreshPayoutData = useCallback(async () => {
    try {
      const [{ totalCoins: lifetime }, history, status] = await Promise.all([
        liveGiftsService.getEarningsSummary(),
        payoutsService.listMyPayoutRequests(),
        payoutsService.getMyConnectStatus(),
      ]);
      setLifetimeCoins(lifetime || 0);
      setMyPayoutRequests(history || []);
      if (status) setConnectStatus(status);
    } catch {
      // Best-effort — sheet still renders with whatever we already had.
    }
  }, []);

  // Open Stripe's hosted onboarding form in the in-app WebView. When
  // the user finishes, Stripe redirects to STRIPE_CONNECT_RETURN_URL
  // and the account.updated webhook flips payoutsEnabled — refresh the
  // sheet on focus so the CTA swaps to "Request payout" without a
  // manual reload.
  const handleStartConnectOnboarding = useCallback(async () => {
    if (connectStarting) return;
    setConnectStarting(true);
    setPayoutError(null);
    try {
      const result = await payoutsService.startStripeConnectOnboarding();
      if (result?.disabled) return; // Coming-soon alert already fired.
      setShowCashOutSheet(false);
      navigation.navigate('WebView', { url: result.url, title: 'Set up payouts' });
    } catch (e) {
      setPayoutError(e?.message || 'Could not start Stripe onboarding');
    } finally {
      setConnectStarting(false);
    }
  }, [connectStarting, navigation]);

  useEffect(() => {
    if (showCashOutSheet) {
      refreshPayoutData();
    }
  }, [showCashOutSheet, refreshPayoutData]);

  // Initial fetch so the earnings badge in the in-stream sheet shows a
  // lifetime number even before the host opens cash-out.
  useEffect(() => { refreshPayoutData(); }, [refreshPayoutData]);

  const handleOpenCashOut = useCallback(() => {
    setPayoutError(null);
    setPayoutSuccessId(null);
    setPayoutDestination('');
    setShowCashOutSheet(true);
  }, []);

  const handleSubmitPayout = useCallback(async () => {
    if (payoutSubmitting) return;
    if (!meetsPayoutThreshold) return;
    // Stripe Connect destination is the connected account on file —
    // no text input. Mobile money / bank transfer still need the user
    // to type their MSISDN / account number for the operator to parse.
    const isStripe = payoutMethod === 'stripe_connect';
    if (!isStripe && !payoutDestination.trim()) {
      setPayoutError('Enter a payout destination so we know where to send it.');
      return;
    }
    setPayoutSubmitting(true);
    setPayoutError(null);
    try {
      const destination = isStripe
        ? { connectAccountId: connectStatus.accountId }
        : { value: payoutDestination.trim() };
      const result = await payoutsService.requestPayout({
        coinAmount: lifetimeCoins,
        method: payoutMethod,
        destination,
      });
      // Payments-coming-soon gate: requestPayout shows its own alert
      // and returns { disabled: true }. Bail without clearing the form
      // so the user can still see what they entered if they want to
      // come back later.
      if (result?.disabled) return;
      setLifetimeCoins(result.balance);
      setPayoutSuccessId(result.requestId);
      setPayoutDestination('');
      // Refresh history so the new pending row shows up at the top.
      const history = await payoutsService.listMyPayoutRequests();
      setMyPayoutRequests(history || []);
    } catch (e) {
      setPayoutError(e?.message || 'Could not submit payout request');
    } finally {
      setPayoutSubmitting(false);
    }
  }, [payoutSubmitting, meetsPayoutThreshold, payoutDestination, lifetimeCoins, payoutMethod, connectStatus.accountId]);

  const handleCashOut = useCallback(() => {
    // Close the earnings sheet first so the cash-out modal doesn't
    // stack on top of it (iOS lets you, but the visual is muddy).
    setShowEarningsSheet(false);
    handleOpenCashOut();
  }, [handleOpenCashOut]);

  // Permission screen — both camera AND microphone are required for
  // a live stream. Request whichever is missing first; the user can
  // grant them in any order before the broadcaster surface mounts.
  if (!permission || !micPermission) return <View style={s.permissionScreen} />;
  if (!permission.granted || !micPermission.granted) {
    const needsCamera = !permission.granted;
    const needsMic = !micPermission.granted;
    // iOS only fires the OS dialog once. After that, `canAskAgain` is
    // false and request*Permission() resolves silently as `denied`.
    // Detect that case and route the user to Settings instead, so they
    // don't tap "Allow Access" repeatedly with nothing happening.
    const cameraBlocked = needsCamera && permission.canAskAgain === false;
    const micBlocked = needsMic && micPermission.canAskAgain === false;
    const mustOpenSettings = cameraBlocked || micBlocked;
    const handleAllow = async () => {
      if (mustOpenSettings) {
        promptToOpenSettings({
          title: needsCamera && needsMic
            ? 'Camera & microphone needed'
            : needsCamera ? 'Camera needed' : 'Microphone needed',
          message: 'Live streams need both. Enable them in Settings to go live.',
        });
        return;
      }
      if (needsCamera) await requestPermission();
      if (needsMic) await requestMicPermission();
    };
    return (
      <View style={s.permissionScreen}>
        <Ionicons name={needsCamera ? 'videocam-outline' : 'mic-outline'} size={64} color="#FFF" />
        <Text style={s.permissionTitle}>
          {needsCamera && needsMic ? 'Camera & Microphone Required' : needsCamera ? 'Camera Access Required' : 'Microphone Access Required'}
        </Text>
        <Text style={s.permissionSub}>
          Live streams need both video and audio so your viewers can see and hear you.
        </Text>
        <TouchableOpacity style={s.permissionBtn} onPress={handleAllow}>
          <Text style={s.permissionBtnText}>Allow Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.permissionBack} onPress={() => navigation.goBack()}>
          <Text style={s.permissionBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      {/* Camera — `mode="video"` enables audio capture for the live broadcast. */}
      {/* Pre-live: expo-camera preview so the host can frame their shot
          without burning Daily.co minutes. Live: Daily's own publishing
          view, which IS the broadcast — viewers see exactly this frame. */}
      {isLive && dailyBroadcast.local?.videoTrack ? (
        <DailyMediaView
          videoTrack={dailyBroadcast.local.videoTrack}
          mirror={facing === 'front'}
          zOrder={0}
          style={s.camera}
        />
      ) : (
        <CameraView style={s.camera} facing={facing} mode="video" />
      )}

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
            <Text style={s.preLiveSub}>Share a moment with the JuNubin community</Text>

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

              {/* Earnings — tappable shortcut to the earnings sheet */}
              <TouchableOpacity
                style={s.earningsBadge}
                onPress={() => setShowEarningsSheet(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="diamond" size={12} color="#FCCD12" />
                <Text style={s.earningsText}>{totalCoins.toLocaleString()}</Text>
              </TouchableOpacity>
            </View>

            <View style={s.topBarRight}>
              <TouchableOpacity style={s.controlBtn} onPress={handleFlipCamera}>
                <Ionicons name="camera-reverse" size={22} color="#FFF" />
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

          {/* Pending join requests tray (host) */}
          {joinRequests.length > 0 && (
            <View style={s.joinRequestsTray} pointerEvents="box-none">
              {joinRequests.slice(0, 3).map((req) => (
                <View key={req.id} style={s.joinRequestCard}>
                  <Text style={s.joinRequestName} numberOfLines={1}>
                    {(req.viewer?.displayName || 'Someone')} wants to join
                  </Text>
                  <View style={s.joinRequestBtns}>
                    <TouchableOpacity
                      onPress={() => handleDeclineJoinRequest(req)}
                      style={[s.joinRequestBtn, s.joinRequestDecline]}
                    >
                      <Text style={s.joinRequestDeclineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleAcceptJoinRequest(req)}
                      style={[s.joinRequestBtn, s.joinRequestAccept]}
                    >
                      <Text style={s.joinRequestAcceptText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

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
          {/* TikTok-style gift banners — slide in from the left above
              the comments. Same sender + same gift in 3s coalesces into
              a "×N" multiplier. Floats above the chat so the host can
              tell who's tipping at a glance. */}
          <View style={[s.giftBanners, { bottom: insets.bottom + 230 }]} pointerEvents="none">
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

          {/* Comments float above the bottom bar. Pushed a few px down
              from the previous +130 offset so the gift banners above
              have breathing room. */}
          <View style={[s.commentsArea, { bottom: insets.bottom + 110 }]}>
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

          {/* Bottom controls — single aligned row matching the viewer's
              live screen so muscle memory transfers between watching and
              broadcasting: chat input pill | emoji popover | gift sheet
              | send. The emoji popover sits above the row when open. */}
          <View style={[s.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            {showEmojiPicker && (
              <View style={s.emojiPopup}>
                {REACTION_EMOJIS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={s.emojiPopBtn}
                    onPress={() => {
                      handleSendReaction(emoji);
                      setShowEmojiPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.emojiPopText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={s.inputRow}>
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
                  onSubmitEditing={handleSendComment}
                />
              </View>

              <TouchableOpacity
                style={[s.iconBtn, showEmojiPicker && s.iconBtnActive]}
                onPress={() => { hapticSelection?.(); setShowEmojiPicker((p) => !p); }}
                accessibilityLabel="Open emoji reactions"
              >
                <Ionicons name="happy-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.giftBtn}
                onPress={() => { hapticSelection?.(); setShowEarningsSheet(true); }}
                accessibilityLabel="View gifts and earnings"
              >
                <Ionicons name="gift" size={18} color="#FCCD12" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.sendBtn, !commentText.trim() && s.sendBtnDisabled]}
                onPress={handleSendComment}
                disabled={!commentText.trim()}
                accessibilityLabel="Send comment"
              >
                <Ionicons name="send" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Earnings sheet — what the gift icon opens for the broadcaster.
          Mirrors the viewer's "Send a gift" sheet visually but inverted:
          this is "gifts received" + a running coin/USD total + a placeholder
          cash-out CTA. Keeps the host's earning loop visible without
          forcing them out of the live view. */}
      <Modal
        visible={showEarningsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEarningsSheet(false)}
      >
        <View style={s.giftOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowEarningsSheet(false)} />
          <View style={s.giftSheet}>
            <View style={s.giftSheetHeader}>
              <Text style={s.giftSheetTitle}>Earnings</Text>
              <TouchableOpacity onPress={() => setShowEarningsSheet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <View style={s.earningsHero}>
              <View style={s.earningsCoinRow}>
                <Ionicons name="diamond" size={22} color="#FCCD12" />
                <Text style={s.earningsCoinNum}>{totalCoins.toLocaleString()}</Text>
              </View>
              <Text style={s.earningsUsd}>≈ ${earnedUsd}</Text>
              <Text style={s.earningsHint}>Coins received this stream</Text>
            </View>

            <Text style={s.recentLabel}>Recent gifts</Text>
            {recentGifts.length === 0 ? (
              <Text style={s.recentEmpty}>
                No gifts yet — viewers' gifts will show up here as they arrive.
              </Text>
            ) : (
              <ScrollView style={s.recentScroll} showsVerticalScrollIndicator={false}>
                {recentGifts.map((g) => (
                  <View key={g.id} style={s.recentRow}>
                    <Text style={s.recentEmoji}>{g.gift.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recentSender}>{g.sender}</Text>
                      <Text style={s.recentGiftName}>sent a {g.gift.name}</Text>
                    </View>
                    <View style={s.recentCoinRow}>
                      <Ionicons name="diamond" size={11} color="#FCCD12" />
                      <Text style={s.recentCoinText}>+{g.gift.cost}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={s.cashOutBtn} onPress={handleCashOut} activeOpacity={0.85}>
              <Ionicons name="card-outline" size={18} color="#000" />
              <Text style={s.cashOutText}>Cash out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Cash-out request sheet ──
          MVP collector: records the creator's request + destination
          into the PayoutRequest queue so the team can fulfill it
          manually. Real Stripe Connect / Flutterwave Transfer routing
          is a separate ticket. */}
      <Modal
        visible={showCashOutSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCashOutSheet(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.giftOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCashOutSheet(false)} />
            <View style={s.giftSheet}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={s.giftSheetHeader}>
                  <Text style={s.giftSheetTitle}>Cash out</Text>
                  <TouchableOpacity onPress={() => setShowCashOutSheet(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>

                {/* Balance hero — shows the lifetime running total
                    rather than the per-stream counter. The conversion
                    rate is documented inline so creators see what
                    they'll actually receive. */}
                <View style={s.earningsHero}>
                  <View style={s.earningsCoinRow}>
                    <Ionicons name="diamond" size={22} color="#FCCD12" />
                    <Text style={s.earningsCoinNum}>{lifetimeCoins.toLocaleString()}</Text>
                  </View>
                  <Text style={s.earningsUsd}>≈ ${lifetimeUsd}</Text>
                  <Text style={s.earningsHint}>
                    Available balance · 100 coins ≈ $1 USD
                  </Text>
                </View>

                {payoutSuccessId ? (
                  <View style={s.payoutSuccessBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#FCCD12" />
                    <Text style={s.payoutSuccessText}>
                      Payout requested. Pending review — payouts process in 3-5 business days.
                    </Text>
                  </View>
                ) : null}

                {!meetsPayoutThreshold ? (
                  <View style={s.payoutThresholdBox}>
                    <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.7)" />
                    <Text style={s.payoutThresholdText}>
                      Earn {PAYOUT_MIN_COINS.toLocaleString()} coins to request a payout
                      ({(PAYOUT_MIN_COINS - lifetimeCoins).toLocaleString()} to go).
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={s.recentLabel}>Method</Text>
                    <View style={s.methodRow}>
                      {PAYOUT_METHODS.map((m) => {
                        const selected = payoutMethod === m.key;
                        return (
                          <TouchableOpacity
                            key={m.key}
                            onPress={() => { setPayoutMethod(m.key); setPayoutError(null); }}
                            style={[s.methodBtn, selected && s.methodBtnActive]}
                            activeOpacity={0.85}
                          >
                            <Ionicons
                              name={m.icon}
                              size={16}
                              color={selected ? '#000' : 'rgba(255,255,255,0.7)'}
                            />
                            <Text style={[s.methodBtnText, selected && s.methodBtnTextActive]}>
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/*
                      Stripe Connect branch: when the user picks Stripe
                      and hasn't finished Connect onboarding (or the
                      account isn't payouts-ready yet), swap the
                      destination input + submit button for an onboarding
                      CTA. KYC is delegated entirely to Stripe — we
                      never see bank numbers.
                    */}
                    {payoutMethod === 'stripe_connect' && !connectStatus.payoutsEnabled ? (
                      <>
                        {payoutError ? (
                          <Text style={s.payoutErrorText}>{payoutError}</Text>
                        ) : null}
                        <TouchableOpacity
                          style={[s.cashOutBtn, connectStarting && s.sendBtnDisabled]}
                          onPress={handleStartConnectOnboarding}
                          disabled={connectStarting}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="card" size={18} color="#000" />
                          <Text style={s.cashOutText}>
                            {connectStarting ? 'Opening Stripe...' : 'Set up Stripe payouts'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={s.payoutFinePrint}>
                          You'll fill out a short Stripe form (ID, bank
                          details) so they can pay you directly. Junubin
                          never sees your bank info.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={s.recentLabel}>Destination</Text>
                        {payoutMethod === 'stripe_connect' ? (
                          /*
                            Stripe Connect destination is implicit (the
                            connected account on file). Render a
                            read-only display rather than a text input
                            so the user can't accidentally type into it.
                          */
                          <View style={s.destinationInput}>
                            <Text style={{ color: '#fff', fontFamily: FontFamily.regular }}>
                              {`Stripe Connect (••••${(connectStatus.accountId || '').slice(-4) || '----'})`}
                            </Text>
                          </View>
                        ) : (
                          <TextInput
                            style={s.destinationInput}
                            placeholder={selectedMethodMeta.placeholder}
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={payoutDestination}
                            onChangeText={(v) => { setPayoutDestination(v); setPayoutError(null); }}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        )}

                        {payoutError ? (
                          <Text style={s.payoutErrorText}>{payoutError}</Text>
                        ) : null}

                        <TouchableOpacity
                          style={[s.cashOutBtn, payoutSubmitting && s.sendBtnDisabled]}
                          onPress={handleSubmitPayout}
                          disabled={payoutSubmitting}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="cash-outline" size={18} color="#000" />
                          <Text style={s.cashOutText}>
                            {payoutSubmitting ? 'Submitting...' : `Request payout (${lifetimeCoins.toLocaleString()} coins)`}
                          </Text>
                        </TouchableOpacity>

                        <Text style={s.payoutFinePrint}>
                          Pending review — payouts process in 3-5 business days. We'll
                          notify you when funds are sent.
                        </Text>
                      </>
                    )}
                  </>
                )}

                {myPayoutRequests.length > 0 ? (
                  <>
                    <Text style={[s.recentLabel, { marginTop: 18 }]}>Recent requests</Text>
                    {myPayoutRequests.slice(0, 5).map((req) => (
                      <View key={req.id} style={s.payoutHistoryRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.payoutHistoryAmount}>
                            {req.coinAmount.toLocaleString()} coins · {req.method.replace('_', ' ')}
                          </Text>
                          <Text style={s.payoutHistoryStatus}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                            {req.rejectionReason ? ` — ${req.rejectionReason}` : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  earningsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(252,205,18,0.15)',
    borderWidth: 1, borderColor: 'rgba(252,205,18,0.35)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  earningsText: { fontSize: 12, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FCCD12' },

  controlBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
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

  // Pending join requests (host)
  joinRequestsTray: {
    position: 'absolute', top: 150, left: 16, right: 16, zIndex: 18, gap: 8,
  },
  joinRequestCard: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  joinRequestName: { color: '#FFF', fontSize: 13, fontFamily: FontFamily.semibold, marginBottom: 8 },
  joinRequestBtns: { flexDirection: 'row', gap: 8 },
  joinRequestBtn: {
    flex: 1,
    paddingVertical: 7, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  joinRequestAccept: { backgroundColor: '#FCCD12' },
  joinRequestDecline: { backgroundColor: 'rgba(255,255,255,0.2)' },
  joinRequestAcceptText: { color: '#000', fontSize: 12, fontFamily: FontFamily.semibold },
  joinRequestDeclineText: { color: '#FFF', fontSize: 12, fontFamily: FontFamily.semibold },

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

  // TikTok-style gift banners — same shape as the viewer screen so the
  // visual language is consistent across both ends of the live.
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
    fontSize: 13, fontFamily: FontFamily.bold, fontWeight: '700',
    color: '#FFFFFF', letterSpacing: -0.1,
  },
  giftBannerKind: {
    fontSize: 11, fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.7)', marginTop: 1,
  },
  giftBannerMultiplier: {
    fontSize: 18, fontFamily: FontFamily.black, fontWeight: '900',
    color: '#FCCD12', letterSpacing: -0.5, marginLeft: 6,
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontFamily: FontFamily.regular,
    paddingVertical: 0,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  giftBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(252,205,18,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#CE1126',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  // Emoji popover — slides up just above the input row when the
  // emoji icon is tapped. Tap any emoji to fire it as a floating
  // reaction (host can react to their own stream); the popup closes
  // automatically.
  emojiPopup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emojiPopBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center', alignItems: 'center',
  },
  emojiPopText: { fontSize: 22 },

  // Earnings sheet — modal mirrors the viewer's gift sheet but inverted
  // (gifts received instead of sent). Black surface, gold accents, scrollable
  // recent-gift list.
  giftOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  giftSheet: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    minHeight: '60%',
  },
  giftSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 18,
  },
  giftSheetTitle: { fontSize: 19, fontWeight: '800', fontFamily: FontFamily.bold, color: '#FFF' },
  earningsHero: {
    alignItems: 'center',
    backgroundColor: 'rgba(252,205,18,0.10)',
    borderWidth: 1, borderColor: 'rgba(252,205,18,0.25)',
    borderRadius: 18,
    paddingVertical: 22,
    marginBottom: 22,
  },
  earningsCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earningsCoinNum: {
    fontSize: 38, fontFamily: FontFamily.black, fontWeight: '900',
    color: '#FFFFFF', letterSpacing: -0.5,
  },
  earningsUsd: {
    fontSize: 15, fontFamily: FontFamily.semibold, fontWeight: '600',
    color: '#FCCD12', marginTop: 4,
  },
  earningsHint: {
    fontSize: 12, fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.55)', marginTop: 6,
  },
  recentLabel: {
    fontSize: 11, fontFamily: FontFamily.bold, fontWeight: '700',
    letterSpacing: 1.6, color: 'rgba(255,255,255,0.55)',
    marginBottom: 10,
  },
  recentScroll: { maxHeight: 220, marginBottom: 14 },
  recentEmpty: {
    fontSize: 13, fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center', paddingVertical: 28,
  },
  recentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recentEmoji: { fontSize: 26 },
  recentSender: {
    fontSize: 14, fontFamily: FontFamily.semibold, fontWeight: '600', color: '#FFF',
  },
  recentGiftName: {
    fontSize: 12, fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.55)', marginTop: 2,
  },
  recentCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentCoinText: {
    fontSize: 13, fontFamily: FontFamily.bold, fontWeight: '700', color: '#FCCD12',
  },
  cashOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FCCD12',
    paddingVertical: 14, borderRadius: 14,
    marginTop: 8,
  },
  cashOutText: {
    fontSize: 15, fontFamily: FontFamily.bold, fontWeight: '700',
    color: '#000', letterSpacing: -0.1,
  },

  // Cash-out request sheet
  payoutThresholdBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    marginBottom: 12,
  },
  payoutThresholdText: {
    flex: 1,
    fontSize: 13, fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.75)', lineHeight: 18,
  },
  payoutSuccessBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(252,205,18,0.12)',
    borderWidth: 1, borderColor: 'rgba(252,205,18,0.35)',
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12,
  },
  payoutSuccessText: {
    flex: 1,
    fontSize: 13, fontFamily: FontFamily.semibold,
    color: '#FCCD12', lineHeight: 18,
  },
  methodRow: { gap: 8, marginBottom: 14 },
  methodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  methodBtnActive: {
    backgroundColor: '#FCCD12',
    borderColor: '#FCCD12',
  },
  methodBtnText: {
    fontSize: 14, fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.85)',
  },
  methodBtnTextActive: { color: '#000' },
  destinationInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: FontFamily.medium,
    color: '#FFF',
    marginBottom: 12,
  },
  payoutErrorText: {
    fontSize: 12, fontFamily: FontFamily.medium,
    color: '#FF6B6B', marginBottom: 8,
  },
  payoutFinePrint: {
    fontSize: 11, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.45)', textAlign: 'center',
    marginTop: 10, lineHeight: 16,
  },
  payoutHistoryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  payoutHistoryAmount: {
    fontSize: 13, fontFamily: FontFamily.semibold,
    color: '#FFF',
  },
  payoutHistoryStatus: {
    fontSize: 11, fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.55)', marginTop: 2,
    textTransform: 'capitalize',
  },
});
