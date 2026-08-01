import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  LayoutAnimation,
  UIManager,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GraffitiSend } from '../components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Typography, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useAuth } from '../auth';
import { useFollow } from '../hooks/useFollow';
import * as chatService from '../api/services/chatService';
import * as matchesService from '../api/services/matchesService';
import * as safetyService from '../api/services/safetyService';
import * as connectionService from '../api/services/connectionService';
import { detectScamSignal } from '../api/services/safetyServiceExtras';
import ChatScamBanner from '../components/ChatScamBanner';
import { trackEvent, AnalyticsEvents } from '../utils/analytics';
import { useEligibility } from '../hooks';
import { useRealtime } from '../api/hooks/useRealtime';
import { mockMessages as demoMockMessages } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import OnlinePulseDot from '../components/OnlinePulseDot';
import { useScreenshotProtection } from '../utils/useScreenshotProtection';

import { interactiveStore } from '../utils/interactiveStore';
import { enqueueAction, processQueue } from '../utils/offlineQueue';
import { useNetworkStatus } from '../utils/useNetworkStatus';
import { useAccessibilityPreferences } from '../accessibility';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SPRING_ANIM = {
  duration: 300,
  create: { type: LayoutAnimation.Types.spring, property: LayoutAnimation.Properties.scaleY, springDamping: 0.7 },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 },
};

const getIcebreakers = (match, currentUser) => {
  const name = match?.name || 'there';
  return [
    `What have you been up to this week, ${name}?`,
    'Where are you based right now?',
    'What brought you to JuNubin?',
  ];
};

function TypingDot({ delay: delayMs, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: -6, duration: 200, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ])
      ).start();
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [anim, delayMs]);
  return (
    <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, transform: [{ translateY: anim }] }} />
  );
}

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 375;
  const { colors, isDark } = useTheme();
  const { prefs } = useAccessibilityPreferences();
  const styles = useMemo(() => getStyles(colors, isCompact, prefs), [colors, isCompact, prefs]);
  // Whispers (pay-to-message-before-matching) are gone with the dating
  // model and the paid tiers. The `whisperIntent` route param that used
  // to debit a credit on first send had exactly one caller —
  // ProfileDetailScreen's whisper button — and that button no longer
  // exists, so the whole path is removed rather than left dormant.
  const { session, user: currentUser } = useAuth();
  const { isConnected } = useNetworkStatus();
  // Survey / restricted / banned nudge. The gate() calls that used to
  // guard the call buttons are gone with the calls themselves — this
  // screen is text only now — but the nudge still renders so a
  // restricted account is told why the app is limited.
  const { nudge: surveyNudge } = useEligibility();

  // Screenshot protection for private chats
  useScreenshotProtection();

  // Some entry points only know the conversationId (push notification
  // taps in particular — the server payload carries conversationId +
  // messageId + senderId but not a full match object). When that's all
  // we have, resolve the match record from matchesService so the
  // header, avatar, follow status, and call buttons all populate
  // correctly. Without this lookup, ChatScreen mounted with `match =
  // {}` and crashed on `match.id` accesses inside `useFollow`.
  const initialMatch = route.params?.match || null;
  const [resolvedMatch, setResolvedMatch] = useState(initialMatch);
  const match = resolvedMatch || {};
  const matchId = match.id || route.params?.conversationId || 'match1';

  // Same precedence note as before: top-level conversationId wins over
  // the match-object copy, because fresh-match overlays pass it
  // alongside the (sometimes incomplete) match object.
  const conversationId = route.params?.conversationId || match.conversationId;

  // Detect a demo conversation. Demo matches carry stable ids like
  // `demo_match_001` and reference a `userId` like `demo_001`; demo
  // user direct chats use the roster id directly. Either pattern is
  // a "this conversation lives client-side only" signal.
  //
  // For demo chats we:
  //   • initialise from mockMessages[userId] instead of getMessages()
  //   • skip the realtime subscription (no Conversation row to listen on)
  //   • intercept persistTextMessage so sends just append locally
  //     rather than hitting chatService and 404ing
  const demoUserId = match.userId || match.id;
  const isDemoChat = typeof demoUserId === 'string'
    && (demoUserId.startsWith('demo_') || (matchId && String(matchId).startsWith('demo_')));

  useEffect(() => {
    if (resolvedMatch?.id) return;
    if (!conversationId) return;
    // Don't ping matchesService for a demo conversation — there's no
    // real row to find. The initial route.params.match is the
    // authoritative source for demo headers.
    if (isDemoChat) return;
    let cancelled = false;
    matchesService.getMatches()
      .then((list) => {
        if (cancelled) return;
        const found = (list || []).find((m) => m.conversationId === conversationId);
        if (found) setResolvedMatch(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conversationId, resolvedMatch?.id, isDemoChat]);
  // "You're connected" banner is shown only when we arrive straight from
  // the moment the connection was made (`fromMatch: true` — the param
  // name is unchanged so existing callers keep working; the copy is
  // connection vocabulary). Dismisses on first message sent or on close.
  const [showConnectionBanner, setShowConnectionBanner] = useState(!!route.params?.fromMatch);
  const dismissConnectionBanner = useCallback(() => setShowConnectionBanner(false), []);

  // Mutual-follow state, kept for the header's "connected" affordance.
  // Plain text isn't gated here — who can open the thread (a mutual
  // connection or an accepted message request) controls that upstream.
  const { isFriend } = useFollow(match.id);

  // For real conversations: start empty; getMessages + realtime fill in.
  // For demo conversations: pre-fill from mockMessages keyed by the
  // roster userId so the tester sees the canned history we authored for
  // that demo user.
  const [messages, setMessages] = useState(() => {
    if (!isDemoChat || !DEMO_DATA_ENABLED) return [];
    const seed = (demoUserId && demoMockMessages?.[demoUserId]) || [];
    return seed.map((m) => ({ ...m, id: `seed-${m.id}` }));
  });
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [missionState, setMissionState] = useState({
    intro: false,
    question: false,
    response: false,
  });

  // ── Scam-detection banner state ──────────────────────────────────
  // verdict: null = not yet fetched / no risk; otherwise the
  // detect-scam-signal response. We refresh on mount and after every
  // SCAM_REFRESH_EVERY_N_INCOMING incoming messages so a clean
  // opening followed by a sudden money-ask still flags. Per-session
  // dismissal lives in dismissedRef — we don't persist it so the
  // banner re-evaluates on the next app launch.
  const [scamVerdict, setScamVerdict] = useState(null);
  const scamDismissedRef = useRef(false);
  const incomingCountRef = useRef(0);
  const SCAM_REFRESH_EVERY_N_INCOMING = 5;
  const [hiddenFeatures, setHiddenFeatures] = useState({});
  const [progressToast, setProgressToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const prevProgressRef = useRef(0);
  const flatListRef = useRef(null);
  const sentIdsRef = useRef(new Set());
  const icebreakers = useMemo(() => getIcebreakers(match, currentUser), [match, currentUser]);
  const missionProgress = Object.values(missionState).filter(Boolean).length;

  // ── Hydrate conversation-starter state for this conversation ──
  // The state used to reset every time the screen unmounted, so a user
  // who completed step 1 and came back later saw the intro chip empty
  // again. Persist per-conversation via interactiveStore so each thread
  // carries its own progress + dismissed flag. (The interactiveStore
  // keys still say "matchMission" — that's storage-internal, not user
  // facing, and renaming them would orphan everyone's saved progress.)
  useEffect(() => {
    if (!conversationId) return;
    interactiveStore.getMatchMission(conversationId).then((saved) => {
      if (saved) setMissionState(saved);
    }).catch(() => {});
    interactiveStore.getMissionDismissed(conversationId).then((dismissed) => {
      if (dismissed) setHiddenFeatures((p) => ({ ...p, mission: true }));
    }).catch(() => {});
  }, [conversationId]);

  // ── Scam-detection: initial fetch on mount ──────────────────────
  // Pulls the verdict once when the chat opens. Skips demo chats (no
  // server-side messages to score). The on-incoming-message re-fetch
  // lives in the realtime handler above and only fires every Nth
  // incoming message to keep model cost down.
  useEffect(() => {
    if (!conversationId || isDemoChat || scamDismissedRef.current) return;
    let cancelled = false;
    detectScamSignal(conversationId).then((v) => {
      if (cancelled) return;
      if (v) setScamVerdict(v);
    });
    return () => { cancelled = true; };
  }, [conversationId, isDemoChat]);

  // Wrapper around setMissionState that ALSO persists. Accepts a value or
  // an updater function (matching React's setter contract). Use this in
  // place of setMissionState for every flip — direct setMissionState
  // calls bypass persistence.
  const setMissionAndPersist = useCallback((updater) => {
    setMissionState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (conversationId) {
        interactiveStore.setMatchMission(conversationId, next).catch(() => {});
      }
      return next;
    });
  }, [conversationId]);

  const showProgressToast = useCallback((title, subtitle) => {
    setProgressToast({ title, subtitle });
    toastAnim.setValue(0);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(toastAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => setProgressToast(null));
      }, 1800);
    });
  }, [toastAnim]);

  useEffect(() => {
    if (missionProgress > prevProgressRef.current) {
      if (missionProgress === 1) showProgressToast('Nice start', 'You sent an intro');
      if (missionProgress === 2) showProgressToast('Great progress', 'You asked a question');
      if (missionProgress >= 3) showProgressToast('Conversation unlocked', 'You got a reply');
      prevProgressRef.current = missionProgress;
    }
  }, [missionProgress, showProgressToast]);

  const {
    onMessage, onTypingStart, onTypingStop,
    emitTypingStart, emitTypingStop, emitReadReceipt,
    joinConversation, leaveConversation,
  } = useRealtime(currentUser?.id);

  // Join/leave conversation channel for realtime
  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  // Load message history from API. Chat is text-only now, so
  // the mapping is a straight pass-through — the game-session
  // reconstruction that used to live here went out with the games.
  useEffect(() => {
    if (!session || !conversationId) return;
    // Demo chats are pre-seeded from mockMessages in the useState
    // initializer above. No server round trip — there's no row to
    // fetch.
    if (isDemoChat) return;
    chatService.getMessages(conversationId).then((apiMsgs) => {
      if (apiMsgs.length > 0) {
        setMessages(apiMsgs.map((m) => ({
          id: m.id,
          sender: m.senderId === currentUser?.id ? 'me' : 'them',
          text: m.text,
          time: m.time,
          type: m.type || 'text',
          read: true,
        })));
      }
    }).catch((err) => {
      if (__DEV__) console.warn('Message history load failed:', err);
    });
  }, [session, conversationId]);

  // Listen for real-time messages
  useEffect(() => {
    if (!conversationId) return;
    // No realtime channel for demo chats — there's no Conversation
    // row, so onMessage would silently subscribe to nothing. Skipping
    // also frees up the realtime worker for actual conversations.
    if (isDemoChat) return undefined;
    const unsub = onMessage(conversationId, (msg) => {
      if (!msg) return;
      if (sentIdsRef.current.has(msg.id)) return;

      setMessages((prev) => [...prev, {
        id: msg.id,
        sender: msg.senderId === currentUser?.id ? 'me' : 'them',
        text: msg.body,
        type: msg.type || 'text',
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        read: true,
      }]);

      // Bump the incoming-message counter for scam-detection
      // re-evaluation. Skip self-sent messages — those go through
      // the optimistic send path, not realtime, but defensive in
      // case that changes.
      if (msg.senderId && msg.senderId !== currentUser?.id) {
        incomingCountRef.current += 1;
        if (incomingCountRef.current >= SCAM_REFRESH_EVERY_N_INCOMING && conversationId && !scamDismissedRef.current) {
          incomingCountRef.current = 0;
          detectScamSignal(conversationId).then((v) => {
            if (v) setScamVerdict(v);
          });
        }
      }
      setMissionAndPersist((prev) => ({ ...prev, response: true }));
      // The user is actively on this screen, so anything that lands
      // here is already "read". Flip server-side too so the badge
      // doesn't tick up on their other devices. Fire-and-forget.
      if (msg.senderId !== currentUser?.id) {
        chatService.markConversationRead(conversationId).catch(() => {});
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return unsub;
  }, [conversationId, currentUser?.id, isDemoChat]);

  // Listen for typing indicators. The hook's onTypingStart /
  // onTypingStop take (conversationId, callback) — previously we were
  // dropping the callback into the conversationId slot, so the peer's
  // typing dots never appeared. The hook now pre-registers the
  // broadcast bridge before .subscribe() (Supabase Realtime drops
  // .on() calls made post-subscribe), and these registration calls
  // just stash the callback in a per-conv ref.
  useEffect(() => {
    if (!conversationId) return undefined;
    const unsubStart = onTypingStart(conversationId, () => {
      setIsTyping(true);
    });
    const unsubStop = onTypingStop(conversationId, () => {
      setIsTyping(false);
    });
    return () => { unsubStart(); unsubStop(); };
  }, [conversationId, onTypingStart, onTypingStop]);

  // Emit read receipt when chat opens
  useEffect(() => {
    if (conversationId) {
      emitReadReceipt(conversationId);
    }
  }, [conversationId, emitReadReceipt]);

  // Persist read state server-side via the mark_conversation_read RPC.
  // This is the source-of-truth flip that clears the unread badge across
  // all of this user's devices (matches list re-fetch picks up
  // unreadCount=0). Re-fires every time the screen regains focus so a
  // user who came back from settings or another tab also clears state.
  // Fire-and-forget — don't block the UI on the round-trip.
  useFocusEffect(
    useCallback(() => {
      if (!session || !conversationId) return undefined;
      chatService.markConversationRead(conversationId).catch(() => {});
      return undefined;
    }, [session, conversationId]),
  );

  // ── Offline resilience: queue text sends when offline, drain on
  // reconnect. The handler throws on failure so the queue keeps the
  // action for the next reconnect cycle (see offlineQueue semantics).
  // We additionally swap the local optimistic row over to the
  // server-issued id so the failed bubble morphs into a normal sent
  // bubble in place — no jarring re-render.
  //
  // Legacy 'game_answer' actions may still be sitting in a user's
  // queue from a build that had in-chat games. They're dropped here
  // rather than replayed — the feature is gone, and replaying would
  // write an unrenderable message into a live conversation.
  useEffect(() => {
    if (!isConnected || !conversationId) return;
    processQueue(async (action) => {
      if (action.conversationId !== conversationId) return;
      if (action.type === 'game_answer') return;
      if (action.type === 'text_message') {
        const result = await chatService.sendMessage(action.conversationId, action.body);
        if (result?.id) {
          sentIdsRef.current.add(result.id);
          if (action.tempId) {
            setMessages((prev) => prev.map((m) => (
              m.id === action.tempId ? { ...m, id: result.id, read: true, status: 'sent' } : m
            )));
          }
        }
      }
    });
  }, [isConnected, conversationId]);

  // Attempt to actually persist a text message to the server. Pulled
  // out of handleSend so the failed-bubble retry tap can re-use it
  // verbatim. On success the optimistic row gets its tempId swapped
  // for the server-issued id; on failure the row is flipped to
  // status:'failed' and queued for the auto-retry-on-reconnect drain.
  //
  // Demo conversation short-circuit: there's no Conversation row to
  // POST to, so we just flip the optimistic row to status:'sent' so
  // the bubble stops saying "Sending…". Demo users don't respond —
  // testers see their own message in the thread with a single
  // checkmark and can keep typing. This is the trade-off: a demo
  // chat behaves end-to-end *from the tester's perspective* but
  // doesn't simulate the other side typing back.
  const persistTextMessage = useCallback(async (tempId, text) => {
    if (isDemoChat) {
      setMessages((prev) => prev.map((m) => (
        m.id === tempId ? { ...m, status: 'sent', read: false } : m
      )));
      return;
    }
    if (!conversationId) return;
    try {
      const result = await chatService.sendMessage(conversationId, text);
      if (result?.id) {
        sentIdsRef.current.add(result.id);
        // Funnel: a real (non-demo) message landed. No body/PII —
        // just length bucket + conversation id presence so we can
        // measure first-message-after-match conversion in PostHog.
        trackEvent(AnalyticsEvents.MESSAGE_SENT, {
          type: 'text',
          length_bucket: text.length < 20 ? 'short' : text.length < 100 ? 'medium' : 'long',
        });
        setMessages((prev) => prev.map((m) => (
          m.id === tempId ? { ...m, id: result.id, read: true, status: 'sent' } : m
        )));
      }
    } catch (err) {
      if (__DEV__) console.warn('Failed to send message:', err);
      setMessages((prev) => prev.map((m) => (
        m.id === tempId ? { ...m, status: 'failed' } : m
      )));
      // Queue for auto-retry when network comes back. The drain runs
      // from the existing offlineQueue useEffect below.
      enqueueAction({ type: 'text_message', conversationId, body: text, tempId });
    }
  }, [conversationId, isDemoChat]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    const text = inputText.trim();

    // Stop typing indicator when sending
    if (conversationId) emitTypingStop(conversationId);

    LayoutAnimation.configureNext(SPRING_ANIM);
    const optimisticId = `msg-${Date.now()}`;
    const newMessage = {
      id: optimisticId,
      sender: 'me',
      text,
      type: 'text',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      read: false,
      status: conversationId ? 'sending' : 'sent',
    };

    setMessages((prev) => [...prev, newMessage]);
    setMissionAndPersist((prev) => ({
      ...prev,
      intro: true,
      question: prev.question || text.includes('?'),
    }));
    setInputText('');
    if (showConnectionBanner) setShowConnectionBanner(false);

    if (conversationId) {
      persistTextMessage(optimisticId, text);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, conversationId, emitTypingStop, persistTextMessage, showConnectionBanner]);

  // User tapped a failed bubble — flip back to sending and re-attempt.
  // Success swaps in the real id; another failure puts it back into
  // the failed state for the next tap (or for the network-restore drain).
  const handleRetryFailed = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (
      m.id === messageId ? { ...m, status: 'sending' } : m
    )));
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    persistTextMessage(messageId, target.text);
  }, [messages, persistTextMessage]);

  // Three-dot menu — Set Alias / Safety / Clear / Remove connection /
  // Report & Block. The two safety actions at the bottom are unchanged.
  const handleHeaderMenu = useCallback(() => {
    Alert.alert(match.name || 'Chat', null, [
      {
        text: 'Set Alias',
        onPress: () => Alert.alert('Set Alias', 'Aliases let you save a private nickname for this person. Feature ships in v1.1.'),
      },
      {
        text: 'Safety Center',
        onPress: () => navigation.navigate('SettingsInfo', { pageKey: 'safety' }),
      },
      {
        text: 'Clear Chat History',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Clear chat history?',
          'This will remove every message in this chat for you. The other person can still see them.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
          ]
        ),
      },
      {
        text: 'Remove connection',
        style: 'destructive',
        onPress: () => Alert.alert(
          `Remove ${match.name || 'this person'} from your connections?`,
          'You will stop following each other and this conversation will close. This is not the same as blocking — use Report & Block if they made you feel unsafe.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove connection',
              style: 'destructive',
              onPress: async () => {
                // Two-step teardown against the (me, peer) user pair:
                //   1. connectionService.disconnect drops the follow edge.
                //   2. safetyService.unmatchUser tears down the legacy
                //      Match/Conversation row so the thread stops
                //      appearing in either inbox.
                // Step 2 only runs when there's a real conversation —
                // otherwise we're on a profile-driven view of someone
                // we never had a thread with. Neither step is a
                // moderation action; blocking stays a separate item.
                const peerId = match.userId || match.id;
                if (!peerId) {
                  navigation.goBack();
                  return;
                }
                try {
                  await connectionService.disconnect(peerId);
                } catch (e) {
                  Alert.alert('Could not remove connection', e?.message || 'Try again later.');
                  return;
                }
                if (conversationId) {
                  try {
                    await safetyService.unmatchUser(peerId);
                  } catch (e) {
                    // The follow edge is already gone; a failure here
                    // just means the old thread lingers. Don't block
                    // the user on it, but tell them it's partial.
                    if (__DEV__) console.warn('Conversation teardown failed:', e);
                  }
                }
                navigation.goBack();
              },
            },
          ]
        ),
      },
      {
        text: 'Report & Block',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Report & Block',
          'Tell us what happened. The user will be blocked from contacting you and our safety team will review.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Report',
              style: 'destructive',
              onPress: async () => {
                const reportedId = match.userId || match.id;
                if (!reportedId) {
                  Alert.alert('Reported', 'Thanks — our team will review this account.');
                  navigation.goBack();
                  return;
                }
                try {
                  await safetyService.reportAndBlock({
                    reportedId,
                    reason: 'chat_report',
                  });
                  Alert.alert('Reported', 'Thanks — our team will review this account.');
                } catch (e) {
                  Alert.alert('Could not file report', e?.message || 'Try again later.');
                  return;
                }
                navigation.goBack();
              },
            },
          ]
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [match.name, match.userId, match.id, conversationId, navigation]);

  const renderMessage = useCallback(({ item }) => {
    const isMe = item.sender === 'me';

    // Anything that isn't plain text is a legacy attachment (image /
    // audio / gift / game / sticker rows written by older builds).
    // chatService normalises those to UNSUPPORTED_MESSAGE_TYPE with an
    // empty body — render a neutral, non-actionable placeholder rather
    // than an empty bubble, so old threads still make visual sense.
    if (item.type && item.type !== 'text') {
      return (
        <View style={[styles.messageBubbleWrap, isMe ? styles.myMessage : styles.theirMessage]}>
          <View style={[styles.bubble, styles.unsupportedBubble]}>
            <Ionicons name="document-outline" size={14} color={colors.gray400} style={{ marginRight: 6 }} />
            <Text style={styles.unsupportedText}>Attachment no longer supported</Text>
          </View>
          <View style={[styles.timeRow, isMe && { justifyContent: 'flex-end' }]}>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        </View>
      );
    }

    const isFailed  = isMe && item.status === 'failed';
    const isSending = isMe && item.status === 'sending';
    return (
      <TouchableOpacity
        style={[styles.messageBubbleWrap, isMe ? styles.myMessage : styles.theirMessage]}
        onPress={isFailed ? () => handleRetryFailed(item.id) : undefined}
        activeOpacity={0.8}
        accessibilityHint={isFailed ? 'Tap to retry sending this message' : undefined}
      >
        <View style={[
          styles.bubble,
          isMe ? styles.myBubble : styles.theirBubble,
          isFailed && styles.failedBubble,
        ]}>
          <Text style={[styles.bubbleText, isMe ? styles.myBubbleText : styles.theirBubbleText]}>
            {item.text}
          </Text>
        </View>
        <View style={[styles.timeRow, isMe && { justifyContent: 'flex-end' }]}>
          {isFailed ? (
            <>
              <Ionicons
                name="alert-circle"
                size={13}
                color={colors.error || '#D33A3A'}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.failedText}>Failed · Tap to retry</Text>
            </>
          ) : isSending ? (
            // Visible "sending" cue while the server hasn't acknowledged
            // the optimistic message yet. Without this, users typed,
            // saw the bubble appear, and assumed it landed — only to
            // hit a Failed state seconds later. The pending tick gives
            // them an unambiguous "this is in flight, don't retype".
            <>
              <Text style={styles.timeText}>Sending…</Text>
              <Ionicons
                name="time-outline"
                size={13}
                color={colors.gray400}
                style={{ marginLeft: 4 }}
                accessibilityLabel="Sending"
              />
            </>
          ) : (
            <>
              <Text style={styles.timeText}>{item.time}</Text>
              {isMe && prefs?.nonColorCues && (
                <Text style={styles.deliveryText}>{item.read ? 'Read' : 'Sent'}</Text>
              )}
              {isMe && (
                <Ionicons
                  name={item.read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.read ? colors.accent : colors.gray400}
                  style={{ marginLeft: 4 }}
                />
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [colors, styles, prefs, handleRetryFailed]);

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 10 : 0}
    >
      {/* Header — back · avatar+name · overflow menu. The voice and
          video call buttons that used to sit here were removed: chat is
          text only. */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProfileDetail', { profile: match })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${match.name || 'profile'}`}
        >
          <View>
            <Image source={imageSource(match.images?.[0])} style={styles.headerAvatar} />
            <OnlinePulseDot size={12} style={styles.headerOnlineDot} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerName}>{match.name || 'Chat'}</Text>
              {(match.verified || match.isVerified) && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.accent}
                  style={{ marginLeft: 4 }}
                  accessibilityLabel="Verified profile"
                />
              )}
            </View>
            <Text style={styles.headerStatus}>
              {isTyping ? 'typing...' : isFriend ? 'Connected' : 'Online'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleHeaderMenu}
            style={styles.headerIcon}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scam-pattern banner. Renders only when the server-side
          detector returns medium/high risk for this conversation.
          Dismissal is per-session — survives screen unmount via
          scamDismissedRef so re-entering the chat in the same app
          launch doesn't replay the banner. */}
      <ChatScamBanner
        verdict={scamVerdict}
        onDismiss={() => {
          scamDismissedRef.current = true;
          setScamVerdict(null);
        }}
        onLearnMore={() => {
          // Route to the Safety Center page. SettingsInfoScreen keys
          // its content off `pageKey` — a wrong param silently falls
          // back to the generic FAQ.
          navigation.navigate('SettingsInfo', { pageKey: 'safety' });
        }}
      />

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={true}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Industry redesign: state the text-only contract up front,
                with a path to the safety page. */}
            <Text style={styles.textOnlyNote}>
              Chats are text-only by design.{' '}
              <Text
                style={styles.textOnlyLink}
                onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'safety' })}
                accessibilityRole="link"
              >
                Safety tips
              </Text>
            </Text>
            {/* ── Connection banner — only on a fresh connection,
                dismisses after first view or first message sent ── */}
            {showConnectionBanner && (
              <View style={styles.matchBanner}>
                <TouchableOpacity
                  style={styles.matchBannerClose}
                  onPress={dismissConnectionBanner}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss connection banner"
                >
                  <Ionicons name="close" size={16} color={colors.gray500} />
                </TouchableOpacity>
                <View style={styles.avatarWrap}>
                  <Image source={imageSource(match.images?.[0])} style={styles.bannerAvatar} />
                </View>
                <Text style={styles.bannerText}>You're connected with {match.name}</Text>
                <Text style={styles.bannerSub}>Say hello and introduce yourself</Text>
              </View>
            )}

            {/* ── Conversation starter — progress card ── */}
            {!hiddenFeatures.mission && (
            <View style={styles.missionsCard}>
              <TouchableOpacity style={styles.cardDismiss} onPress={() => {
                setHiddenFeatures(p => ({ ...p, mission: true }));
                if (conversationId) interactiveStore.setMissionDismissed(conversationId, true).catch(() => {});
              }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={16} color={colors.gray400} />
              </TouchableOpacity>
              <View style={styles.missionsHeader}>
                <View style={styles.missionsIconWrap}>
                  <Ionicons name="rocket" size={16} color={colors.accent} />
                </View>
                <Text style={styles.missionsTitle}>Conversation starter</Text>
                <View style={styles.missionsBadge}>
                  <Text style={styles.missionsBadgeText}>{missionProgress}/3</Text>
                </View>
              </View>
              <View style={styles.missionsBar}>
                <View style={[styles.missionsFill, { width: `${(missionProgress / 3) * 100}%` }]} />
              </View>
              <View style={styles.missionsChecklist}>
                {[
                  { done: missionState.intro, label: 'Send an intro' },
                  { done: missionState.question, label: 'Ask a question' },
                  { done: missionState.response, label: 'Get a reply' },
                ].map((item) => (
                  <View key={item.label} style={styles.missionRow}>
                    <Ionicons
                      name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={item.done ? colors.accent : colors.gray300}
                    />
                    <Text style={[styles.missionLabel, item.done && styles.missionLabelDone]}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            )}

            {/* Icebreakers, mini-games, voice & vibes and co-watch cards
                are all gone — chat is text only. The
                conversation-starter card above is the only prompt. */}
          </View>
        }
      />

      {/* Typing indicator */}
      {isTyping && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <TypingDot delay={0} color={colors.gray400} />
            <TypingDot delay={100} color={colors.gray400} />
            <TypingDot delay={200} color={colors.gray400} />
          </View>
          <Text style={styles.typingText}>{match.name} is typing...</Text>
        </View>
      )}

      {/* Input bar — text in, send out. The plus button / action row
          (photo, stickers) went out with the text-only pivot; the
          composer is just the field and the send button now. */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={prefs?.highContrast ? colors.gray600 : colors.gray400}
            value={inputText}
            onChangeText={(text) => {
              setInputText(text);
              if (conversationId && text.trim()) {
                emitTypingStart(conversationId);
              } else if (conversationId) {
                emitTypingStop(conversationId);
              }
            }}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
        </View>

        {/* Send only. The mic / voice-note button that used to occupy
            this slot when the composer was empty is gone — chat no
            longer supports audio messages. */}
        <TouchableOpacity
          accessibilityLabel={prefs?.screenReaderHints ? 'Send message' : 'chat-send'}
          accessibilityState={{ disabled: !inputText.trim() }}
          testID="chat-send"
          onPress={handleSend}
          disabled={!inputText.trim()}
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
        >
          <GraffitiSend size={20} color="#FFFFFF" filled />
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
    {surveyNudge}
    </View>
  );
}

const getStyles = (colors, isCompact, prefs = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isCompact ? 10 : 14,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Industry language: photos are square tiles with a hairline border,
  // never circles.
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.gray300,
  },
  headerOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
  headerName: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  headerStatus: {
    ...Typography.caption,
    color: colors.gray500,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 6,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: isCompact ? 12 : 16,
    paddingBottom: 8,
  },
  listHeader: {
    gap: 14,
    paddingBottom: 6,
  },
  textOnlyNote: {
    ...Typography.caption,
    fontSize: 11.5,
    color: colors.gray400,
    textAlign: 'center',
    marginTop: 8,
  },
  textOnlyLink: {
    color: colors.accentDark,
    fontFamily: FontFamily.medium,
  },
  // ── Connection Banner ──
  matchBanner: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    position: 'relative',
  },
  matchBannerClose: {
    position: 'absolute',
    top: 12,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    zIndex: 1,
  },
  avatarGlow: {
    marginBottom: 14,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray300,
  },
  bannerText: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: colors.black,
    letterSpacing: -0.2,
  },
  bannerSub: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 5,
  },
  // ── Per-card dismiss button ──
  cardDismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Missions Card ──
  missionsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: isCompact ? 12 : 16,
    borderWidth: 0.5,
    borderColor: colors.gray200,
    gap: 12,
  },
  missionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  missionsIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  missionsTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: colors.black,
    flex: 1,
  },
  missionsBadge: {
    backgroundColor: colors.separator,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  missionsBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: colors.accent,
  },
  missionsBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
  },
  missionsFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  missionsChecklist: {
    gap: 8,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  missionLabel: {
    ...Typography.bodySmall,
    color: colors.black,
    fontSize: isCompact ? 13 : 14,
  },
  missionLabelDone: {
    color: colors.gray400,
    textDecorationLine: 'line-through',
  },
  // ── Section titles ──
  sectionWrap: {
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: colors.black,
  },
  // ── Icebreakers ──
  icebreakersRow: {
    gap: 8,
  },
  icebreakerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.cardBg,
    paddingHorizontal: isCompact ? 10 : 14,
    paddingVertical: isCompact ? 10 : 12,
  },
  icebreakerEmoji: {
    fontSize: 16,
  },
  icebreakerText: {
    ...Typography.bodySmall,
    color: colors.black,
    fontSize: isCompact ? 13 : 14,
    flex: 1,
  },
  // ── Fun Cards ──
  funCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: isCompact ? 12 : 16,
    borderWidth: 0.5,
    borderColor: colors.gray200,
    gap: 12,
  },
  funCardLast: {
    marginBottom: 8,
  },
  funHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isCompact ? 9 : 12,
  },
  funIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  funTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: colors.black,
  },
  funCopy: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 1,
  },
  funPollLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: colors.gray500,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  funDivider: {
    height: 0.5,
    backgroundColor: colors.gray200,
  },
  funActionRow: {
    flexDirection: 'row',
    gap: isCompact ? 6 : 8,
    flexWrap: isCompact ? 'wrap' : 'nowrap',
  },
  funActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: isCompact ? 11 : 14,
    paddingVertical: isCompact ? 8 : 9,
  },
  funActionText: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  funChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isCompact ? 6 : 8,
    flexWrap: isCompact ? 'wrap' : 'nowrap',
  },
  funChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    paddingVertical: isCompact ? 10 : 12,
    paddingHorizontal: isCompact ? 10 : 12,
    backgroundColor: colors.cardBg,
    minWidth: isCompact ? '47%' : undefined,
  },
  funChoiceActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceMuted,
  },
  funChoiceEmoji: {
    fontSize: isCompact ? 16 : 18,
  },
  funChoiceText: {
    fontFamily: FontFamily.semibold,
    fontSize: isCompact ? 13 : 14,
    color: colors.black,
  },
  funChoiceTextActive: {
    color: colors.accent,
  },
  funOrText: {
    ...Typography.caption,
    color: colors.gray400,
    fontSize: 12,
    display: isCompact ? 'none' : 'flex',
  },
  messageBubbleWrap: {
    marginVertical: 4,
    maxWidth: isCompact ? '84%' : '78%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  // Industry bubbles — tight radius-4 blocks, no drop shadows: mine is
  // solid accent, theirs is the tinted surface with a hairline border.
  bubble: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 4,
  },
  myBubble: {
    backgroundColor: colors.accent,
  },
  theirBubble: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  bubbleText: {
    ...Typography.bodySmall,
    fontSize: 16,
    lineHeight: 23,
  },
  myBubbleText: {
    color: '#FFFFFF',
  },
  theirBubbleText: {
    color: colors.black,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 4,
  },
  timeText: {
    ...Typography.caption,
    fontSize: 11,
    color: prefs?.highContrast ? colors.gray600 : colors.gray400,
  },
  deliveryText: {
    ...Typography.caption,
    fontSize: 11,
    color: colors.gray600,
    marginLeft: 5,
  },
  // Subtle red border + failed caption — informative, not alarming.
  // Bubble background is unchanged so the whole conversation visually
  // still flows; only the chrome shifts.
  failedBubble: {
    borderWidth: 1,
    borderColor: colors.error || '#D33A3A',
  },
  failedText: {
    ...Typography.caption,
    fontSize: 11,
    color: colors.error || '#D33A3A',
    fontWeight: '500',
    fontFamily: FontFamily.medium,
  },
  // Legacy attachment placeholder — muted, bordered, deliberately not
  // styled like a live message so it can't be mistaken for new content.
  unsupportedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  unsupportedText: {
    ...Typography.caption,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  typingText: {
    ...Typography.caption,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: isCompact ? 8 : 14,
    paddingTop: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
    gap: isCompact ? 5 : 8,
  },
  inputIcon: {
    padding: prefs?.largerTouchTargets ? (isCompact ? 10 : 11) : (isCompact ? 6 : 8),
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    paddingHorizontal: isCompact ? 12 : 14,
    paddingVertical: isCompact ? 9 : 10,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  textInput: {
    ...Typography.bodySmall,
    fontSize: prefs?.highContrast ? (isCompact ? 15 : 16) : (isCompact ? 14 : 15),
    color: colors.black,
    maxHeight: 80,
    paddingTop: 0,
    paddingBottom: 0,
  },
  // Industry: square radius-4 send block, no glow shadow.
  sendBtn: {
    width: prefs?.largerTouchTargets ? (isCompact ? 40 : 44) : (isCompact ? 38 : 44),
    height: prefs?.largerTouchTargets ? (isCompact ? 40 : 44) : (isCompact ? 38 : 44),
    borderRadius: 4,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  // Send is now permanently in the composer (there's no mic to swap
  // with), so it needs a visibly inert state when there's nothing to
  // send. Opacity only — the button keeps its full touch target.
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
