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
import * as ImagePicker from 'expo-image-picker';
import { GraffitiSend } from '../components/icons';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Typography, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useFollow } from '../hooks/useFollow';
import * as callService from '../api/services/callService';
import * as chatService from '../api/services/chatService';
import * as matchesService from '../api/services/matchesService';
import * as safetyService from '../api/services/safetyService';
import * as liveGiftsService from '../api/services/liveGiftsService';
import { useEligibility } from '../hooks';
import { supabase } from '../config/supabase';
import { useRealtime } from '../api/hooks/useRealtime';
import { mockMessages as demoMockMessages } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import OnlinePulseDot from '../components/OnlinePulseDot';
import ChatImageBubble from '../components/ChatImageBubble';
import ChatAudioBubble from '../components/ChatAudioBubble';
import VoiceRecorder from '../components/VoiceRecorder';
import ChatReactionPicker from '../components/ChatReactionPicker';
import GiftPicker from '../components/GiftPicker';
import GiftBubble from '../components/GiftBubble';
import GiftAnimation from '../components/GiftAnimation';
import GamePickerSheet from '../components/GamePickerSheet';
import GameBubble from '../components/GameBubble';
import GameResultOverlay from '../components/GameResultOverlay';
import { createGameSession, createSessionFromInvite, processMyAnswer, processTheirAnswer, advanceRound, serializeGameMessage, deserializeGameMessage, isTimedOut, markTimedOut, roundSummaryText, serializeActiveGames, deserializeActiveGames } from '../utils/gameEngine';
import { hapticMedium, hapticHeavy } from '../utils/haptics';
import { useScreenshotProtection } from '../utils/useScreenshotProtection';

import { interactiveStore } from '../utils/interactiveStore';
import CoinPurchaseSheet from '../components/CoinPurchaseSheet';
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
  const lines = [
    `What made you smile today, ${name}?`,
    'What is your perfect first hang?',
    'What are you currently into this week?',
  ];
  if (currentUser?.preferences?.mode === 'Social') {
    lines.unshift('Want to trade favorite events in town?');
  }
  return lines.slice(0, 3);
};
const CHAT_STICKERS = ['🔥', '✨', '💫', '🎧', '💌'];
// MINI_GAME_PROMPT / POLL_PROMPT removed — the inline mini-game and
// duo-poll widgets they fed were dropped in the v1 chat simplification,
// leaving the constants orphaned. Whoever brings those features back
// should source the copy from src/data/games.js or a server-driven
// catalogue rather than reintroducing the hardcoded strings here.
const WHEEL_LINES = [
  'Tell me one thing that made you laugh today.',
  'What is your comfort movie?',
  'Where should we go for our first hang?',
  'Your current playlist mood in one word?',
];

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
  const { hasTier, coins, consumeCoins, consumeWhisper } = useSubscription();
  // Set when ProfileDetail navigates here with `whisperIntent: true`.
  // The first send consumes one whisper credit; subsequent sends are
  // free (the conversation is now an ordinary chat).
  //
  // Sync with route.params on every change — useState(route.params)
  // would only read on first mount, so re-entering the screen with a
  // fresh `whisperIntent: true` would silently keep the old false
  // state and the user's whisper credit would never debit.
  const [pendingWhisper, setPendingWhisper] = useState(!!route.params?.whisperIntent);
  useEffect(() => {
    setPendingWhisper(!!route.params?.whisperIntent);
  }, [route.params?.whisperIntent]);
  const { session, user: currentUser } = useAuth();
  const { isConnected } = useNetworkStatus();
  // Eligibility gate for call buttons. Survey/restricted/banned win
  // before the existing JuNubin+ paywall so an empty-profile subscriber
  // still gets the survey nudge instead of the call screen.
  const { gate, lastVerdict, nudge: surveyNudge } = useEligibility();

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
  // "You matched" banner is shown only when we arrive directly from the match
  // celebration overlay (`fromMatch: true`). It dismisses on first scroll,
  // first message sent, or explicit close.
  const [showMatchBanner, setShowMatchBanner] = useState(!!route.params?.fromMatch);
  const dismissMatchBanner = useCallback(() => setShowMatchBanner(false), []);

  // Relationship gate — fun features (games, calls) require: friend (mutual
  // follow) OR you follow them OR you have a confirmed match (conversation).
  const { isFollowing, isFriend } = useFollow(match.id);
  const canConnect = isFriend || isFollowing || !!conversationId;
  const requireConnection = useCallback((featureName) => {
    if (canConnect) return true;
    Alert.alert(
      'Connect first',
      `${featureName} are only available with friends, people you follow, or matches. Follow ${match.name || 'this user'} to unlock.`,
      [{ text: 'OK', style: 'cancel' }]
    );
    return false;
  }, [canConnect, match.name]);

  // For real matches: start empty; getMessages + realtime fill in.
  // For demo matches: pre-fill from mockMessages keyed by the roster
  // userId so the tester sees the canned history we authored for that
  // demo user. Real matches still get the empty Match Mission state.
  const [messages, setMessages] = useState(() => {
    if (!isDemoChat || !DEMO_DATA_ENABLED) return [];
    const seed = (demoUserId && demoMockMessages?.[demoUserId]) || [];
    return seed.map((m) => ({ ...m, id: `seed-${m.id}` }));
  });
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPosition, setReactionPosition] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [showCoinSheet, setShowCoinSheet] = useState(false);
  const [giftAnimation, setGiftAnimation] = useState(null);
  const [missionState, setMissionState] = useState({
    intro: false,
    question: false,
    response: false,
  });
  const [miniGamePick, setMiniGamePick] = useState(null);
  const [duoPollVote, setDuoPollVote] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const [voiceIntroPlayed, setVoiceIntroPlayed] = useState(false);
  const [activeSticker, setActiveSticker] = useState(CHAT_STICKERS[0]);
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [showActionRow, setShowActionRow] = useState(false);
  const [showGamePicker, setShowGamePicker] = useState(route.params?.startGame || false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceUploading, setVoiceUploading] = useState(false);
  const [hiddenFeatures, setHiddenFeatures] = useState({});
  const [activeGames, setActiveGames] = useState(new Map());
  const [gameResult, setGameResult] = useState(null);
  const [progressToast, setProgressToast] = useState(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const prevProgressRef = useRef(0);
  const flatListRef = useRef(null);
  const sentIdsRef = useRef(new Set());
  const activeGamesRef = useRef(activeGames);
  activeGamesRef.current = activeGames;
  const icebreakers = useMemo(() => getIcebreakers(match, currentUser), [match, currentUser]);
  const missionProgress = Object.values(missionState).filter(Boolean).length;

  // ── Hydrate Match Mission state for this conversation ──
  // The mission state used to reset every time the screen unmounted, so a
  // user who completed step 1 and came back later saw the intro chip
  // empty again. Persist per-conversation via interactiveStore so each
  // thread carries its own progress + dismissed flag.
  useEffect(() => {
    if (!conversationId) return;
    interactiveStore.getMatchMission(conversationId).then((saved) => {
      if (saved) setMissionState(saved);
    }).catch(() => {});
    interactiveStore.getMissionDismissed(conversationId).then((dismissed) => {
      if (dismissed) setHiddenFeatures((p) => ({ ...p, mission: true }));
    }).catch(() => {});
  }, [conversationId]);

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

  useEffect(() => {
    if (gameResult) {
      showProgressToast('Game complete', 'Nice play — keep it going');
    }
  }, [gameResult, showProgressToast]);

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

  // Load message history from API — reconstruct game sessions from saved messages
  useEffect(() => {
    if (!session || !conversationId) return;
    // Demo chats are pre-seeded from mockMessages in the useState
    // initializer above. No server round trip — there's no row to
    // fetch.
    if (isDemoChat) return;
    chatService.getMessages(conversationId).then((apiMsgs) => {
      if (apiMsgs.length > 0) {
        const gameSessions = new Map();
        const renderedGameIds = new Set(); // Only render one bubble per game
        const mapped = [];

        for (const m of apiMsgs) {
          const isMe = m.senderId === currentUser?.id;
          const msgType = m.type || 'text';

          // Reconstruct game sessions from history
          if (msgType === 'game') {
            const gameData = deserializeGameMessage(m.text);
            if (gameData?.gameId) {
              // Build/update session state from all game messages
              if (!gameSessions.has(gameData.gameId)) {
                if (isMe) {
                  gameSessions.set(gameData.gameId, {
                    id: gameData.gameId,
                    type: gameData.type,
                    name: gameData.name,
                    emoji: gameData.emoji,
                    color: gameData.color,
                    round: gameData.round || 0,
                    totalRounds: gameData.totalRounds,
                    questions: gameData.questions || [],
                    myAnswers: gameData.myAnswers || [],
                    theirAnswers: [],
                    status: gameData.status || 'playing',
                  });
                } else {
                  const sess = createSessionFromInvite(gameData);
                  if (sess) gameSessions.set(gameData.gameId, sess);
                }
              } else {
                // Update existing session with latest answers
                const existing = gameSessions.get(gameData.gameId);
                if (isMe) {
                  existing.myAnswers = gameData.myAnswers || existing.myAnswers;
                } else {
                  existing.theirAnswers = gameData.myAnswers || existing.theirAnswers;
                }
                existing.round = Math.max(existing.round, gameData.round || 0);
                existing.status = gameData.status || existing.status;
              }

              // Only add the first message per game as a renderable bubble
              if (!renderedGameIds.has(gameData.gameId)) {
                renderedGameIds.add(gameData.gameId);
                mapped.push({
                  id: m.id,
                  sender: isMe ? 'me' : 'them',
                  text: m.text,
                  time: m.time,
                  type: 'game',
                  gameId: gameData.gameId,
                  read: true,
                });
              }
              continue; // Skip adding duplicate game messages
            }
          }

          mapped.push({
            id: m.id,
            sender: isMe ? 'me' : 'them',
            text: m.text,
            time: m.time,
            type: msgType,
            read: true,
          });
        }

        setMessages(mapped);
        if (gameSessions.size > 0) {
          setActiveGames((prev) => {
            const merged = new Map(prev);
            for (const [id, sess] of gameSessions) merged.set(id, sess);
            return merged;
          });
        }
      }
    }).catch((err) => {
      if (__DEV__) console.warn('Message history load failed:', err);
    });
  }, [session, conversationId]);

  // Helper: schedule auto-advance after reveal state (shared by answer handler & realtime)
  const scheduleAutoAdvance = useCallback((gameId) => {
    setTimeout(() => {
      setActiveGames((p) => {
        const m = new Map(p);
        const s = m.get(gameId);
        if (!s || s.status !== 'revealed') return p;

        // Inject round summary message before advancing
        const summary = roundSummaryText(s, s.round);
        const summaryMsg = {
          id: `summary-${gameId}-r${s.round}`,
          sender: 'system',
          type: 'game_summary',
          text: summary,
          time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        };
        setMessages((msgs) => [...msgs, summaryMsg]);

        const advanced = advanceRound(s);
        m.set(gameId, advanced);
        if (advanced.status === 'complete') {
          hapticHeavy();
          setGameResult(advanced);

          // Cleanup: remove completed game after 30s
          setTimeout(() => {
            setActiveGames((prev) => {
              const next = new Map(prev);
              next.delete(gameId);
              return next;
            });
          }, 30000);
        }
        return m;
      });
    }, 800);
  }, []);

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

      // Handle incoming game messages
      if (msg.type === 'game') {
        const gameData = deserializeGameMessage(msg.body);
        if (!gameData?.gameId) return;

        setActiveGames((prev) => {
          const map = new Map(prev);
          const existing = map.get(gameData.gameId);

          if (!existing) {
            // New game invitation from partner — create session on our side
            const newSession = createSessionFromInvite(gameData);
            if (!newSession) return prev;
            map.set(gameData.gameId, newSession);

            // Add game invite as a chat message so the bubble renders
            const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            setMessages((msgs) => [...msgs, {
              id: msg.id,
              sender: 'them',
              type: 'game',
              gameId: gameData.gameId,
              text: msg.body,
              time,
              read: true,
            }]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          } else {
            // Existing game — partner sent an answer update
            // Only apply the answer for the current round to avoid overwriting
            const theirLatestAnswer = gameData.myAnswers?.[existing.round];
            if (theirLatestAnswer !== undefined && existing.theirAnswers[existing.round] === undefined) {
              const updated = processTheirAnswer(existing, theirLatestAnswer);
              map.set(gameData.gameId, updated);
              // If their answer triggered revealed state, auto-advance
              if (updated.status === 'revealed') {
                scheduleAutoAdvance(gameData.gameId);
              }
            }
          }
          return map;
        });
        return; // Don't add answer updates as separate chat messages
      }

      setMessages((prev) => [...prev, {
        id: msg.id,
        sender: msg.senderId === currentUser?.id ? 'me' : 'them',
        text: msg.body,
        type: msg.type || 'text',
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        read: true,
      }]);
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
  }, [conversationId, currentUser?.id, scheduleAutoAdvance, isDemoChat]);

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

  // Subscribe to MessageReaction inserts/deletes for this conversation
  // so a reaction added on another device pops up here in real time.
  // Filtered Postgres CDC via Supabase Realtime — only fires for rows
  // belonging to messages in the active conversation, so the listener
  // is cheap.
  useEffect(() => {
    if (!conversationId) return undefined;
    const channel = supabase.channel(`reactions:${conversationId}`);
    const applyDelta = (payload) => {
      const r = payload.new || payload.old;
      if (!r?.messageId) return;
      setMessages((prev) => prev.map((m) => {
        if (m.id !== r.messageId) return m;
        const list = Array.isArray(m.reactions) ? m.reactions : [];
        if (payload.eventType === 'INSERT') {
          if (list.find((x) => x.id === r.id)) return m;
          return { ...m, reactions: [...list, r] };
        }
        if (payload.eventType === 'DELETE') {
          return { ...m, reactions: list.filter((x) => x.id !== r.id) };
        }
        return m;
      }));
    };
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'MessageReaction' }, applyDelta)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'MessageReaction' }, applyDelta)
      .subscribe();
    return () => {
      try { channel.unsubscribe(); supabase.removeChannel(channel); } catch {}
    };
  }, [conversationId]);

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

  // ── Game timeout check: every 10s, mark waiting games as timed out ──
  // Surfaces a toast for any game that just transitioned to timed-out so
  // the user gets feedback instead of the previous silent flip — they
  // were sending answers into a game that had already ended.
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveGames((prev) => {
        let changed = false;
        let timedOutCount = 0;
        const next = new Map(prev);
        for (const [id, s] of next) {
          if (isTimedOut(s)) {
            next.set(id, markTimedOut(s));
            changed = true;
            timedOutCount += 1;
          }
        }
        if (timedOutCount > 0) {
          const subtitle = timedOutCount === 1
            ? 'Send a new one to keep playing.'
            : `${timedOutCount} games ran out of time.`;
          showProgressToast('Game ended', subtitle);
        }
        return changed ? next : prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [showProgressToast]);

  // ── Game persistence: save activeGames on change, restore on mount ──
  useEffect(() => {
    if (!conversationId) return;
    if (activeGames.size === 0) return;
    interactiveStore.setActiveGames(conversationId, serializeActiveGames(activeGames));
  }, [activeGames, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    interactiveStore.getActiveGames(conversationId).then((saved) => {
      if (saved && saved.length > 0) {
        setActiveGames((prev) => {
          // API-loaded sessions take precedence; cached fills gaps
          const merged = new Map(prev);
          const cached = deserializeActiveGames(saved);
          for (const [id, s] of cached) {
            if (!merged.has(id)) merged.set(id, s);
          }
          return merged;
        });
      }
    }).catch(() => {});
  }, [conversationId]);

  // ── Offline resilience: queue game answers + text sends when offline,
  // drain on reconnect. Each handler throws on failure so the queue
  // keeps the action for the next reconnect cycle (see offlineQueue
  // semantics). For text_message we additionally swap the local
  // optimistic row over to the server-issued id so the failed bubble
  // morphs into a normal sent bubble in place — no jarring re-render.
  useEffect(() => {
    if (!isConnected || !conversationId) return;
    processQueue(async (action) => {
      if (action.conversationId !== conversationId) return;
      if (action.type === 'game_answer') {
        await chatService.sendMessage(action.conversationId, action.body, 'game');
        return;
      }
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

    // Whisper credit is debited on the FIRST send only — opening the
    // composer alone shouldn't cost. After this, conversation is an
    // ordinary chat.
    if (pendingWhisper) {
      consumeWhisper();
      setPendingWhisper(false);
    }

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
    if (showMatchBanner) setShowMatchBanner(false);

    if (conversationId) {
      persistTextMessage(optimisticId, text);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, conversationId, emitTypingStop, pendingWhisper, consumeWhisper, persistTextMessage, showMatchBanner]);

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

  const handlePhoto = useCallback(async () => {
    // Permission gate. iOS denials are permanent (canAskAgain === false)
    // — push the user to Settings instead of silently failing.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      if (perm.canAskAgain === false) {
        promptToOpenSettings({
          title: 'Photo access needed',
          message: 'JuNubin needs photo access to send pictures in chat. Open Settings to enable it.',
        });
      }
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    if (!conversationId) return;

    // Optimistic insert — drop the bubble with status: 'sending' so the
    // sender sees it instantly. Realtime won't echo it back to us (we
    // append the saved row ourselves on success), so de-dupe is by id.
    const optimisticId = `msg-img-${Date.now()}`;
    LayoutAnimation.configureNext(SPRING_ANIM);
    const optimisticMsg = {
      id: optimisticId,
      sender: 'me',
      isMe: true,
      type: 'image',
      uri,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      read: false,
      status: 'sending',
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const message = await chatService.sendImageMessage(conversationId, uri);
      setMessages((prev) => prev.map((m) => (
        m.id === optimisticId
          ? { ...m, id: message.id, uri: message.url || uri, status: 'sent', createdAt: message.createdAt }
          : m
      )));
    } catch (e) {
      setMessages((prev) => prev.map((m) => (
        m.id === optimisticId ? { ...m, status: 'failed' } : m
      )));
      Alert.alert('Photo failed', e?.message || 'Could not send your photo.');
    }
  }, [conversationId]);

  const handleVoiceNote = useCallback(() => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Voice notes require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setShowVoiceRecorder(true);
  }, [hasTier, navigation]);

  const handlePlayVoiceIntro = useCallback(() => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Voice intros are available on JuNubin+ and higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setVoiceIntroPlayed(true);
  }, [hasTier, navigation, matchId]);

  const handleVoiceNoteComplete = useCallback(async ({ uri, duration }) => {
    setShowVoiceRecorder(false);
    if (!uri || !conversationId) return;
    setVoiceUploading(true);
    try {
      const message = await chatService.sendAudioMessage(conversationId, uri, duration);
      // Append the saved message to the local list. Realtime subscription will
      // also drop a copy in for the recipient — for the sender we drop it
      // directly so the bubble appears instantly without round-tripping.
      setMessages((prev) => [
        ...prev,
        {
          id: message.id,
          text: '',
          time: '',
          isMe: true,
          createdAt: message.createdAt,
          read: true,
          type: 'audio',
          uri,
          duration,
        },
      ]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Voice note failed', e?.message || 'Could not send your voice note.');
    } finally {
      setVoiceUploading(false);
    }
  }, [conversationId]);

  const handleMiniGamePick = useCallback((pick) => {
    setMiniGamePick(pick);
    setInputText(`Mini-game pick: ${pick}. What did you choose?`);
  }, [matchId]);

  const handleDuoVote = useCallback((vote) => {
    setDuoPollVote(vote);
  }, [matchId]);

  const handleSpinWheel = useCallback(() => {
    const line = WHEEL_LINES[Math.floor(Math.random() * WHEEL_LINES.length)];
    setInputText(line);
  }, [matchId]);

  const handleStartSync = useCallback(() => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Co-watch and co-listen sync requires JuNubin+.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setSyncState('syncing');
    setTimeout(() => setSyncState('live'), 1200);
  }, [hasTier, navigation, matchId]);

  const handleSendSticker = useCallback(() => {
    if (!hasTier('junub')) {
      Alert.alert('Junub Feature', 'Sticker messages are available on Junub and higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    LayoutAnimation.configureNext(SPRING_ANIM);
    const msg = {
      id: `msg-sticker-${Date.now()}`,
      sender: 'me',
      text: activeSticker,
      type: 'sticker',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      read: false,
    };
    setMessages((prev) => [...prev, msg]);
    setMissionAndPersist((prev) => ({ ...prev, intro: true }));
    setShowStickerTray(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [hasTier, navigation, activeSticker, matchId]);

  const handleToggleStickerTray = useCallback(() => {
    if (!hasTier('junub')) {
      Alert.alert('Junub Feature', 'Sticker tray is available on Junub and higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setShowStickerTray((v) => !v);
  }, [hasTier, navigation]);

  const handleOpenGamePicker = useCallback(() => {
    if (!requireConnection('Games')) return;
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'In-chat games require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setShowGamePicker(true);
  }, [hasTier, navigation, requireConnection]);

  // Start an outgoing call: signal the receiver via Supabase Realtime, persist
  // the attempt to the local call log, then push CallScreen in 'outgoing' state.
  const startCall = useCallback((callType) => {
    const callId = callService.newCallId();
    const caller = {
      id: currentUser?.id,
      name: currentUser?.name || currentUser?.displayName,
      avatar: currentUser?.images?.[0],
    };
    if (match.id) {
      callService.sendInvite(match.id, { callId, callType, caller, conversationId }).catch(() => {});
    }
    callService.recordCall({
      callId,
      direction: 'outgoing',
      callType,
      peer: { id: match.id, name: match.name, avatar: match.images?.[0] },
      status: 'dialing',
    });
    navigation.navigate('Call', {
      match,
      callType,
      callId,
      direction: 'outgoing',
    });
  }, [navigation, match, currentUser, conversationId]);

  // Three-dot menu — Set Alias / Safety / Clear / Unmatch / Report & Block
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
        text: 'Unmatch',
        style: 'destructive',
        onPress: () => Alert.alert(
          `Unmatch ${match.name || 'this person'}?`,
          'You will both stop seeing each other in matches and chat.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unmatch',
              style: 'destructive',
              onPress: async () => {
                // The RPC works on the (me, peer) user pair — only call it
                // when we have a peer user id and a real conversation
                // (otherwise we're just on a profile-driven view of someone
                // we never actually matched with).
                const peerId = match.userId || match.id;
                if (peerId && conversationId) {
                  try {
                    await safetyService.unmatchUser(peerId);
                  } catch (e) {
                    Alert.alert('Could not unmatch', e?.message || 'Try again later.');
                    return;
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
  }, [match.name, navigation]);

  const handleVideoCall = useCallback(() => {
    if (!requireConnection('Video calls')) return;
    if (!gate('video_call_match')) {
      // gate() shows survey/banned/restricted UI itself. For
      // tier_required it returns false silently — fall through to the
      // existing JuNubin+ paywall below.
      const v = lastVerdict();
      if (v?.reason !== 'tier_required') return;
    }
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Video calls require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    startCall('video');
  }, [gate, lastVerdict, hasTier, navigation, requireConnection, startCall]);

  const handleVoiceCall = useCallback(() => {
    if (!requireConnection('Voice calls')) return;
    if (!gate('call_match')) {
      const v = lastVerdict();
      if (v?.reason !== 'tier_required') return;
    }
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Calls require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    startCall('voice');
  }, [gate, lastVerdict, hasTier, navigation, requireConnection, startCall]);

  const handleLongPressMessage = useCallback((item, event) => {
    if (item?.type !== 'text') return;
    const pageX = event?.nativeEvent?.pageX ?? 180;
    const pageY = event?.nativeEvent?.pageY ?? 260;
    setSelectedMessageId(item.id);
    setReactionPosition({ x: pageX, y: pageY });
    setShowReactionPicker(true);
  }, []);

  const handleReaction = useCallback(async (reaction) => {
    if (!selectedMessageId) return;
    // Optimistic flip — single-user reaction shown inline on the bubble.
    // Multi-user reaction stacks live below the bubble (rendered from
    // `reactions` state populated via Realtime).
    setMessages((prev) => prev.map((m) =>
      m.id === selectedMessageId ? { ...m, reaction: reaction.emoji } : m
    ));
    setShowReactionPicker(false);
    try {
      await chatService.toggleReaction(selectedMessageId, reaction.emoji);
    } catch (err) {
      // Roll back the inline marker on failure.
      setMessages((prev) => prev.map((m) =>
        m.id === selectedMessageId ? { ...m, reaction: undefined } : m
      ));
      if (__DEV__) console.warn('Reaction persist failed:', err?.message);
    }
  }, [selectedMessageId]);

  const handleGiftSelect = useCallback((gift) => {
    if (!consumeCoins(gift.coins)) {
      setShowCoinSheet(true);
      return;
    }
    setShowGiftPicker(false);
    setGiftAnimation(gift);

    // Persist server-side so the recipient's running total survives
    // the chat session. The peer is the host of this gift (same id
    // resolution used elsewhere in the screen for unmatch / report).
    // Fire-and-forget — local UI shouldn't wait on the round-trip.
    const peerId = match.userId || match.id;
    const giftType = gift.id || gift.type || gift.name || 'unknown';
    const coinAmount = Number(gift.coins) || 0;
    if (peerId && coinAmount > 0) {
      liveGiftsService
        .recordLiveGift({
          hostUserId: peerId,
          giftType,
          coinAmount,
          context: 'chat',
        })
        .catch(() => {});
    }

    LayoutAnimation.configureNext(SPRING_ANIM);
    const msg = {
      id: `msg-gift-${Date.now()}`,
      sender: 'me',
      type: 'gift',
      gift,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      read: false,
    };
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [consumeCoins, navigation, match.userId, match.id]);

  const handleGameSelect = useCallback((game) => {
    setShowGamePicker(false);
    if (!requireConnection('Games')) return;
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'In-chat games require JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const session = createGameSession(game.type);
    if (!session) return;

    setActiveGames((prev) => new Map(prev).set(session.id, session));

    LayoutAnimation.configureNext(SPRING_ANIM);
    const msg = {
      id: `msg-game-${session.id}`,
      sender: 'me',
      type: 'game',
      gameId: session.id,
      text: serializeGameMessage(session),
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      read: false,
    };
    setMessages((prev) => [...prev, msg]);

    if (conversationId) {
      chatService.sendMessage(conversationId, serializeGameMessage(session), 'game').then((result) => {
        if (result?.id) sentIdsRef.current.add(result.id);
      }).catch((err) => {
        if (__DEV__) console.warn('Failed to send game message:', err);
      });
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [conversationId, hasTier, navigation, requireConnection]);

  const handleGameAnswer = useCallback((gameId, answer) => {
    hapticMedium();

    // Compute updated session first so we can send it via chat without stale data
    const currentSession = activeGamesRef.current.get(gameId);
    if (!currentSession) return;

    let updated = processMyAnswer(currentSession, answer);

    // Simulate partner answer for demo (when no conversationId / mock mode)
    if (!conversationId) {
      const simAnswer = typeof answer === 'number'
        ? Math.floor(Math.random() * (currentSession.questions[currentSession.round].options?.length || 2))
        : (Math.random() > 0.5 ? 'A' : 'B');
      updated = processTheirAnswer(updated, simAnswer);
    }

    setActiveGames((prev) => new Map(prev).set(gameId, updated));

    // Auto-advance after reveal
    if (updated.status === 'revealed') {
      scheduleAutoAdvance(gameId);
    }

    // Send answer via chat (using the freshly computed session, not stale closure)
    if (conversationId) {
      const body = serializeGameMessage(updated);
      if (isConnected) {
        chatService.sendMessage(conversationId, body, 'game').then((result) => {
          if (result?.id) sentIdsRef.current.add(result.id);
        }).catch((err) => {
          if (__DEV__) console.warn('Failed to send game answer:', err);
          // Queue for retry on reconnect
          enqueueAction({ type: 'game_answer', conversationId, body });
        });
      } else {
        // Offline: queue the answer
        enqueueAction({ type: 'game_answer', conversationId, body });
      }
    }
  }, [conversationId, scheduleAutoAdvance, isConnected]);

  const handleGamePlayAgain = useCallback((gameType) => {
    setGameResult(null);
    const game = { type: gameType };
    handleGameSelect(game);
  }, [handleGameSelect]);

  useEffect(() => {
    interactiveStore.getWeeklyChallenges().then((saved) => {
      if (saved?.mini_game) setMiniGamePick('Done');
      if (saved?.voice_intro) setVoiceIntroPlayed(true);
    }).catch(() => {});
  }, []);

  const renderMessage = useCallback(({ item }) => {
    const isMe = item.sender === 'me';

    // Image message
    if (item.type === 'image') {
      return <ChatImageBubble uri={item.uri} isMe={isMe} time={item.time} colors={colors} />;
    }

    // Audio message
    if (item.type === 'audio') {
      return <ChatAudioBubble uri={item.uri} duration={item.duration} isMe={isMe} time={item.time} colors={colors} />;
    }

    // Gift message
    if (item.type === 'gift') {
      return <GiftBubble gift={item.gift} isMe={isMe} time={item.time} colors={colors} />;
    }

    // Game round summary (centered pill)
    if (item.type === 'game_summary') {
      return (
        <View style={styles.gameSummaryWrap}>
          <View style={styles.gameSummaryPill}>
            <Text style={styles.gameSummaryText}>{item.text}</Text>
          </View>
        </View>
      );
    }

    // Game message
    if (item.type === 'game') {
      const session = activeGames.get(item.gameId);
      if (!session) return null;
      return (
        <GameBubble
          session={session}
          isMe={isMe}
          time={item.time}
          matchName={match.name}
          onAnswer={(ans) => handleGameAnswer(item.gameId, ans)}
          onPlayAgain={() => handleGamePlayAgain(session.type)}
          colors={colors}
        />
      );
    }

    // Text message (default)
    if (item.type === 'sticker') {
      return (
        <View style={[styles.messageBubbleWrap, isMe ? styles.myMessage : styles.theirMessage]}>
          <Text style={styles.stickerBubble}>{item.text}</Text>
          <View style={[styles.timeRow, isMe && { justifyContent: 'flex-end' }]}>
            <Text style={styles.timeText}>{item.time}</Text>
          </View>
        </View>
      );
    }

    // Text message (default)
    const isFailed  = isMe && item.status === 'failed';
    const isSending = isMe && item.status === 'sending';
    return (
      <TouchableOpacity
        style={[styles.messageBubbleWrap, isMe ? styles.myMessage : styles.theirMessage]}
        onLongPress={(e) => handleLongPressMessage(item, e)}
        onPress={isFailed ? () => handleRetryFailed(item.id) : undefined}
        activeOpacity={0.8}
        delayLongPress={300}
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
          {item.reaction && <Text style={styles.reactionEmoji}>{item.reaction}</Text>}
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
  }, [colors, styles, prefs, handleLongPressMessage, handleRetryFailed, activeGames, handleGameAnswer, handleGamePlayAgain, match.name]);

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 10 : 0}
    >
      {/* Header — original horizontal layout: back · avatar+name · call/video/menu. */}
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
              {isTyping ? 'typing...' : 'Online'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleVoiceCall} style={styles.headerIcon}>
            <Ionicons name="call" size={18} color={colors.black} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleVideoCall} style={styles.headerIcon}>
            <Ionicons name="videocam" size={20} color={colors.black} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleHeaderMenu} style={styles.headerIcon}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

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
            {/* ── Match Banner — only on fresh match, dismisses after first view ── */}
            {showMatchBanner && (
              <View style={styles.matchBanner}>
                <TouchableOpacity
                  style={styles.matchBannerClose}
                  onPress={dismissMatchBanner}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss match banner"
                >
                  <Ionicons name="close" size={16} color={colors.gray500} />
                </TouchableOpacity>
                <View style={styles.avatarWrap}>
                  <Image source={imageSource(match.images?.[0])} style={styles.bannerAvatar} />
                </View>
                <Text style={styles.bannerText}>You matched with {match.name}!</Text>
                <Text style={styles.bannerSub}>Say something to break the ice</Text>
              </View>
            )}

            {/* ── Match Mission — progress card ── */}
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
                <Text style={styles.missionsTitle}>Match Mission</Text>
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

            {/* Icebreakers / Mini Game / Voice & Vibes / Co-watch cards
                were removed for v1 — Match Mission alone is the
                conversation starter. State + handlers for those cards
                still exist below; they're inert with no UI hooked up. */}
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

      {/* Sticker popup (floats above input bar) */}
      {showStickerTray && (
        <View style={[styles.stickerPopup, { bottom: insets.bottom + 62 }]}>
          {CHAT_STICKERS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[styles.stickerChoice, activeSticker === emoji && styles.stickerChoiceActive]}
              onPress={() => setActiveSticker(emoji)}
              accessibilityLabel={`Sticker ${emoji}`}
              accessibilityRole="button"
            >
              <Text style={styles.stickerChoiceText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.stickerSend} onPress={handleSendSticker}>
            <Text style={styles.stickerSendText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          accessibilityLabel={prefs?.screenReaderHints ? 'More actions' : 'chat-plus'}
          testID="chat-plus"
          onPress={() => {
            LayoutAnimation.configureNext(SPRING_ANIM);
            setShowActionRow((v) => !v);
          }}
          style={styles.plusBtn}
        >
          <Ionicons name={showActionRow ? 'close' : 'add'} size={22} color={colors.accent} />
        </TouchableOpacity>

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

        {inputText.trim() ? (
          <TouchableOpacity
            accessibilityLabel={prefs?.screenReaderHints ? 'Send message' : 'chat-send'}
            testID="chat-send"
            onPress={handleSend}
            style={styles.sendBtn}
          >
            <GraffitiSend size={20} color="#FFFFFF" filled />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            accessibilityLabel={prefs?.screenReaderHints ? 'Send voice note' : 'chat-mic'}
            testID="chat-mic"
            onPress={handleVoiceNote}
            style={styles.inputIcon}
          >
            <Ionicons name="mic" size={24} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Expandable action row */}
      {showActionRow && (
        <View style={[styles.actionRow, { paddingBottom: insets.bottom > 0 ? 4 : 8 }]}>
          <TouchableOpacity
            accessibilityLabel={prefs?.screenReaderHints ? 'Attach a photo' : 'chat-photo'}
            testID="chat-photo"
            onPress={handlePhoto}
            style={styles.actionIcon}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="image" size={22} color={colors.accent} />
            </View>
            <Text style={styles.actionIconLabel}>Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={prefs?.screenReaderHints ? 'Send a gift' : 'chat-gift'}
            testID="chat-gift"
            onPress={() => setShowGiftPicker(true)}
            style={styles.actionIcon}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="gift" size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionIconLabel}>Gift</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={prefs?.screenReaderHints ? 'Open sticker tray' : 'chat-sticker'}
            testID="chat-sticker"
            onPress={handleToggleStickerTray}
            style={styles.actionIcon}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="sparkles" size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionIconLabel}>Sticker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={prefs?.screenReaderHints ? 'Open in-chat games' : 'chat-game'}
            testID="chat-game"
            onPress={handleOpenGamePicker}
            style={styles.actionIcon}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="game-controller" size={20} color={colors.accent} />
            </View>
            <Text style={styles.actionIconLabel}>Game</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reaction picker */}
      <ChatReactionPicker
        visible={showReactionPicker}
        position={reactionPosition}
        onSelect={handleReaction}
        onClose={() => setShowReactionPicker(false)}
        colors={colors}
      />

      {/* Gift picker */}
      <GiftPicker
        visible={showGiftPicker}
        onSelect={handleGiftSelect}
        onClose={() => setShowGiftPicker(false)}
        coins={coins}
        colors={colors}
      />

      {/* Gift animation overlay */}
      {giftAnimation && (
        <GiftAnimation gift={giftAnimation} onComplete={() => setGiftAnimation(null)} />
      )}

      {/* Game picker */}
      <GamePickerSheet
        visible={showGamePicker}
        onSelect={handleGameSelect}
        onClose={() => setShowGamePicker(false)}
        colors={colors}
      />

      {/* Game result overlay */}
      <GameResultOverlay
        visible={!!gameResult}
        session={gameResult}
        matchName={match.name}
        onPlayAgain={() => gameResult && handleGamePlayAgain(gameResult.type)}
        onClose={() => setGameResult(null)}
      />
      <CoinPurchaseSheet visible={showCoinSheet} onClose={() => setShowCoinSheet(false)} />

      <VoiceRecorder
        visible={showVoiceRecorder}
        onCancel={() => setShowVoiceRecorder(false)}
        onComplete={handleVoiceNoteComplete}
      />
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
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  gameSummaryWrap: {
    alignItems: 'center',
    marginVertical: 6,
  },
  gameSummaryPill: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  gameSummaryText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    textAlign: 'center',
  },
  listHeader: {
    gap: 14,
    paddingBottom: 6,
  },
  // ── Match Banner ──
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
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  theirBubble: {
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
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
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  stickerBubble: {
    fontSize: 34,
    lineHeight: 38,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    paddingHorizontal: isCompact ? 14 : 18,
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
  sendBtn: {
    width: prefs?.largerTouchTargets ? (isCompact ? 40 : 44) : (isCompact ? 38 : 42),
    height: prefs?.largerTouchTargets ? (isCompact ? 40 : 44) : (isCompact ? 38 : 42),
    borderRadius: prefs?.largerTouchTargets ? (isCompact ? 20 : 22) : (isCompact ? 19 : 21),
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  plusBtn: {
    width: prefs?.largerTouchTargets ? 42 : 38,
    height: prefs?.largerTouchTargets ? 42 : 38,
    borderRadius: prefs?.largerTouchTargets ? 21 : 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    marginBottom: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.cardBg,
  },
  actionIcon: {
    alignItems: 'center',
    gap: 4,
    minWidth: 60,
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconLabel: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.gray500,
  },
  stickerPopup: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: isCompact ? 8 : 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 50,
  },
  stickerChoice: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.cardBg,
  },
  stickerChoiceActive: {
    borderColor: colors.accent,
    backgroundColor: colors.separator,
  },
  stickerChoiceText: {
    fontSize: 20,
  },
  stickerSend: {
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.accent,
  },
  stickerSendText: {
    ...Typography.captionBold,
    color: '#FFF',
  },
});
