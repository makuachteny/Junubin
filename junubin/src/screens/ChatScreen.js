// Chat thread — claude.ai/design "JuNubin Redesign", Chat thread overlay.
//
// Header: back · 38px square avatar · name over presence status; the
// whole profile block opens ProfileDetail. Body: day dividers with a
// letterspaced condensed label, a one-line text-only notice under the
// first divider, then bubbles — mine on ink, theirs on the warm
// surface. Composer: 44px input + 44px gold send square.
//
// All transport behavior is unchanged from the previous build:
// optimistic sends with retry, offline queue drain, realtime receive,
// typing, read receipts, scam-signal banner, legacy-attachment
// placeholders and demo-conversation short-circuits.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useAuth } from '../auth';
import * as chatService from '../api/services/chatService';
import * as conversationService from '../api/services/conversationService';
import * as safetyService from '../api/services/safetyService';
import * as connectionService from '../api/services/connectionService';
import { detectScamSignal } from '../api/services/safetyServiceExtras';
import ChatScamBanner from '../components/ChatScamBanner';
import { trackEvent, AnalyticsEvents } from '../utils/analytics';
import { useEligibility } from '../hooks';
import { useRealtime } from '../api/hooks/useRealtime';
import { mockMessages as demoMockMessages } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import { useScreenshotProtection } from '../utils/useScreenshotProtection';
import { enqueueAction, processQueue, KEEP } from '../utils/offlineQueue';
import { useNetworkStatus } from '../utils/useNetworkStatus';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SPRING_ANIM = {
  duration: 300,
  create: { type: LayoutAnimation.Types.spring, property: LayoutAnimation.Properties.scaleY, springDamping: 0.7 },
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 },
};

// Day-divider label: "TODAY" for today's messages, a real date for
// anything older (year appended only when it isn't this year).
const dayLabel = (date) => {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'TODAY';
  const opts = { month: 'long', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString([], opts).toUpperCase();
};

export default function ChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { session, user: currentUser } = useAuth();
  const { isConnected } = useNetworkStatus();
  // Survey / restricted / banned nudge — renders so a restricted
  // account is told why the app is limited.
  const { nudge: surveyNudge } = useEligibility();

  // Screenshot protection for private chats
  useScreenshotProtection();

  // Some entry points only know the conversationId (push notification
  // taps in particular). When that's all we have, resolve the peer
  // record from conversationService so the header populates correctly.
  const initialPeer = route.params?.peer || route.params?.thread || null;
  const [resolvedPeer, setResolvedPeer] = useState(initialPeer);
  const peer = resolvedPeer || {};
  const threadId = peer.id || route.params?.conversationId || 'thread1';

  // Top-level conversationId wins over the peer-object copy, because
  // fresh-connection overlays pass it alongside the sometimes incomplete
  // peer object.
  const conversationId = route.params?.conversationId || peer.conversationId;

  // Demo conversations live client-side only: seed from mockMessages,
  // skip realtime, and short-circuit sends locally.
  const demoUserId = peer.userId || peer.id;
  const isDemoChat = typeof demoUserId === 'string'
    && (demoUserId.startsWith('demo_') || (threadId && String(threadId).startsWith('demo_')));

  useEffect(() => {
    if (resolvedPeer?.id) return;
    if (!conversationId) return;
    if (isDemoChat) return;
    let cancelled = false;
    conversationService.getConversations()
      .then((list) => {
        if (cancelled) return;
        const found = (list || []).find((thread) => thread.conversationId === conversationId);
        if (found) setResolvedPeer(found);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conversationId, resolvedPeer?.id, isDemoChat]);

  const [messages, setMessages] = useState(() => {
    if (!isDemoChat || !DEMO_DATA_ENABLED) return [];
    const seed = (demoUserId && demoMockMessages?.[demoUserId]) || [];
    return seed.map((m) => ({ ...m, id: `seed-${m.id}` }));
  });
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // ── Scam-detection banner state ──────────────────────────────────
  // Refresh on mount and after every SCAM_REFRESH_EVERY_N_INCOMING
  // incoming messages so a clean opening followed by a sudden
  // money-ask still flags. Per-session dismissal lives in
  // scamDismissedRef — not persisted, so the banner re-evaluates on
  // the next app launch.
  const [scamVerdict, setScamVerdict] = useState(null);
  const scamDismissedRef = useRef(false);
  const incomingCountRef = useRef(0);
  const SCAM_REFRESH_EVERY_N_INCOMING = 5;
  const flatListRef = useRef(null);
  const sentIdsRef = useRef(new Set());

  useEffect(() => {
    if (!conversationId || isDemoChat || scamDismissedRef.current) return;
    let cancelled = false;
    detectScamSignal(conversationId).then((v) => {
      if (cancelled) return;
      if (v) setScamVerdict(v);
    });
    return () => { cancelled = true; };
  }, [conversationId, isDemoChat]);

  const {
    onMessage, onTypingStart, onTypingStop,
    emitTypingStart, emitTypingStop, emitReadReceipt, onReadReceipt,
    joinConversation, leaveConversation,
  } = useRealtime(currentUser?.id);

  // Join/leave conversation channel for realtime
  useEffect(() => {
    if (!conversationId) return;
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  // Load message history from API — a straight pass-through, chat is
  // text only.
  useEffect(() => {
    if (!session || !conversationId) return;
    if (isDemoChat) return;
    chatService.getMessages(conversationId).then((apiMsgs) => {
      if (apiMsgs.length > 0) {
        setMessages(apiMsgs.map((m) => ({
          id: m.id,
          sender: m.senderId === currentUser?.id ? 'me' : 'them',
          text: m.text,
          time: m.time,
          createdAt: m.createdAt,
          type: m.type || 'text',
          // Keep the service's computed receipt: for my messages it's
          // Boolean(readAt).
          read: m.read,
        })));
      }
    }).catch((err) => {
      if (__DEV__) console.warn('Message history load failed:', err);
    });
  }, [session, conversationId]);

  // Listen for real-time messages
  useEffect(() => {
    if (!conversationId) return;
    if (isDemoChat) return undefined;
    const unsub = onMessage(conversationId, (msg) => {
      if (!msg) return;
      if (sentIdsRef.current.has(msg.id)) return;
      // Self-sent messages arrive via the optimistic path + REST ack —
      // never append them from realtime, the echo can beat the HTTP
      // response on a slow link and double the bubble.
      if (msg.senderId && msg.senderId === currentUser?.id) return;

      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, {
        id: msg.id,
        sender: 'them',
        text: msg.body,
        type: msg.type || 'text',
        time: new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        createdAt: msg.createdAt,
        read: true,
      }]));

      // Bump the incoming-message counter for scam-detection
      // re-evaluation.
      if (msg.senderId && msg.senderId !== currentUser?.id) {
        incomingCountRef.current += 1;
        if (incomingCountRef.current >= SCAM_REFRESH_EVERY_N_INCOMING && conversationId && !scamDismissedRef.current) {
          incomingCountRef.current = 0;
          detectScamSignal(conversationId).then((v) => {
            if (v) setScamVerdict(v);
          });
        }
      }
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

  // Typing indicators — surfaced as the header status line.
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

  // Peer opened the thread → flip my delivered bubbles to "Read".
  useEffect(() => {
    if (!conversationId || isDemoChat) return undefined;
    const unsub = onReadReceipt(conversationId, (payload) => {
      if (!payload || payload.userId === currentUser?.id) return;
      setMessages((prev) => prev.map((m) => (
        m.sender === 'me' && !m.read ? { ...m, read: true } : m
      )));
    });
    return unsub;
  }, [conversationId, isDemoChat, onReadReceipt, currentUser?.id]);

  // Emit read receipt when chat opens
  useEffect(() => {
    if (conversationId) {
      emitReadReceipt(conversationId);
    }
  }, [conversationId, emitReadReceipt]);

  // Persist read state server-side via the mark_conversation_read RPC —
  // the source-of-truth flip that clears the unread badge across all
  // of this user's devices. Re-fires on every focus.
  useFocusEffect(
    useCallback(() => {
      if (!session || !conversationId) return undefined;
      chatService.markConversationRead(conversationId).catch(() => {});
      return undefined;
    }, [session, conversationId]),
  );

  // ── Offline resilience: queue text sends when offline, drain on
  // reconnect. The handler throws on failure so the queue keeps the
  // action for the next reconnect cycle. Legacy 'game_answer' actions
  // from builds that had in-chat games are dropped, not replayed.
  useEffect(() => {
    if (!isConnected || !conversationId) return;
    processQueue(async (action) => {
      // Not this conversation's action — RETAIN it for whichever
      // screen owns it.
      if (action.conversationId !== conversationId) return KEEP;
      if (action.type === 'game_answer') return;
      if (action.type === 'text_message') {
        const result = await chatService.sendMessage(action.conversationId, action.body);
        if (result?.id) {
          sentIdsRef.current.add(result.id);
          if (action.tempId) {
            setMessages((prev) => prev.map((m) => (
              m.id === action.tempId ? { ...m, id: result.id, read: false, status: 'sent' } : m
            )));
          }
        }
      }
    });
  }, [isConnected, conversationId]);

  // Attempt to persist a text message to the server. On success the
  // optimistic row gets its tempId swapped for the server-issued id;
  // on failure the row is flipped to status:'failed' and queued for
  // the auto-retry-on-reconnect drain. Demo conversations just flip
  // to 'sent' — there's no row to POST to.
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
        // just a length bucket for conversion measurement.
        trackEvent(AnalyticsEvents.MESSAGE_SENT, {
          type: 'text',
          length_bucket: text.length < 20 ? 'short' : text.length < 100 ? 'medium' : 'long',
        });
        setMessages((prev) => prev.map((m) => (
          m.id === tempId ? { ...m, id: result.id, read: false, status: 'sent' } : m
        )));
      }
    } catch (err) {
      if (__DEV__) console.warn('Failed to send message:', err);
      setMessages((prev) => prev.map((m) => (
        m.id === tempId ? { ...m, status: 'failed' } : m
      )));
      enqueueAction({ type: 'text_message', conversationId, body: text, tempId });
    }
  }, [conversationId, isDemoChat]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    // A real (non-demo) thread without a conversationId has nowhere to
    // persist — refuse loudly instead of rendering a bubble that only
    // pretends to send.
    if (!conversationId && !isDemoChat) {
      Alert.alert(
        "Can't send yet",
        'This conversation could not be opened. Go back and try again from their profile.',
      );
      return;
    }
    const text = inputText.trim();

    if (conversationId) emitTypingStop(conversationId);

    LayoutAnimation.configureNext(SPRING_ANIM);
    const optimisticId = `msg-${Date.now()}`;
    const newMessage = {
      id: optimisticId,
      sender: 'me',
      text,
      type: 'text',
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      createdAt: new Date().toISOString(),
      read: false,
      status: conversationId ? 'sending' : 'sent',
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    if (conversationId) {
      persistTextMessage(optimisticId, text);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [inputText, conversationId, isDemoChat, emitTypingStop, persistTextMessage]);

  // User tapped a failed bubble — flip back to sending and re-attempt.
  const handleRetryFailed = useCallback((messageId) => {
    setMessages((prev) => prev.map((m) => (
      m.id === messageId ? { ...m, status: 'sending' } : m
    )));
    const target = messages.find((m) => m.id === messageId);
    if (!target) return;
    persistTextMessage(messageId, target.text);
  }, [messages, persistTextMessage]);

  // Three-dot menu — Safety / Remove connection / Report & Block.
  // Blocked-user handling and the safety flows live here; the design's
  // header is minimal but these must stay reachable from the thread.
  const handleHeaderMenu = useCallback(() => {
    Alert.alert(peer.name || 'Chat', null, [
      {
        text: 'Safety Center',
        onPress: () => navigation.navigate('SettingsInfo', { pageKey: 'safety' }),
      },
      {
        text: 'Remove connection',
        style: 'destructive',
        onPress: () => Alert.alert(
          `Remove ${peer.name || 'this person'} from your connections?`,
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
                const peerId = peer.userId || peer.id;
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
                    if (__DEV__) console.warn('Conversation teardown failed:', e);
                  }
                }
                navigation.goBack();
              },
            },
          ],
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
                const reportedId = peer.userId || peer.id;
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
          ],
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [peer.name, peer.userId, peer.id, conversationId, navigation]);

  // Interleave day dividers into the message list, with the text-only
  // notice pinned under the first divider. An empty thread still shows
  // "TODAY" + the notice, matching the design's fresh-thread state.
  const listItems = useMemo(() => {
    const items = [];
    let lastDay = null;
    messages.forEach((m) => {
      const d = m.createdAt ? new Date(m.createdAt) : new Date();
      const dayKey = Number.isNaN(d.getTime()) ? 'today' : d.toDateString();
      if (dayKey !== lastDay) {
        items.push({
          id: `day-${dayKey}`,
          kind: 'day',
          label: dayKey === 'today' ? 'TODAY' : dayLabel(d),
        });
        if (lastDay === null) items.push({ id: 'text-only-notice', kind: 'notice' });
        lastDay = dayKey;
      }
      items.push({ ...m, kind: 'message' });
    });
    if (items.length === 0) {
      items.push({ id: 'day-today', kind: 'day', label: 'TODAY' });
      items.push({ id: 'text-only-notice', kind: 'notice' });
    }
    return items;
  }, [messages]);

  const renderItem = useCallback(({ item }) => {
    if (item.kind === 'day') {
      return (
        <View style={styles.dayDivider}>
          <View style={styles.dayLine} />
          <Text style={styles.dayLabel}>{item.label}</Text>
          <View style={styles.dayLine} />
        </View>
      );
    }

    if (item.kind === 'notice') {
      return (
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
      );
    }

    const isMe = item.sender === 'me';

    // Anything that isn't plain text is a legacy attachment (image /
    // audio / gift / game rows written by older builds). chatService
    // normalises those to UNSUPPORTED_MESSAGE_TYPE with an empty body —
    // render a neutral, non-actionable placeholder.
    if (item.type && item.type !== 'text') {
      return (
        <View style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}>
          <View style={[styles.bubble, styles.theirBubble, styles.unsupportedBubble]}>
            <Ionicons name="document-outline" size={14} color={colors.gray400} style={{ marginRight: 6 }} />
            <Text style={styles.unsupportedText}>Attachment no longer supported</Text>
          </View>
        </View>
      );
    }

    const isFailed = isMe && item.status === 'failed';
    const isSending = isMe && item.status === 'sending';
    return (
      <TouchableOpacity
        style={[styles.messageRow, isMe ? styles.myRow : styles.theirRow]}
        onPress={isFailed ? () => handleRetryFailed(item.id) : undefined}
        activeOpacity={isFailed ? 0.8 : 1}
        disabled={!isFailed}
        accessibilityHint={isFailed ? 'Tap to retry sending this message' : undefined}
      >
        <View style={[
          styles.bubble,
          isMe ? styles.myBubble : styles.theirBubble,
          isFailed && styles.failedBubble,
        ]}>
          <Text style={isMe ? styles.myBubbleText : styles.theirBubbleText}>
            {item.text}
          </Text>
        </View>
        {/* Delivery meta — the design shows bare bubbles, so this row
            only appears when it carries information: in-flight, failed,
            or the read receipt on my messages. */}
        {isMe && (
          <View style={styles.metaRow}>
            {isFailed ? (
              <>
                <Ionicons name="alert-circle" size={13} color={colors.error} style={{ marginRight: 4 }} />
                <Text style={styles.failedText}>Failed · Tap to retry</Text>
              </>
            ) : isSending ? (
              <>
                <Text style={styles.metaText}>Sending…</Text>
                <Ionicons
                  name="time-outline"
                  size={12}
                  color={colors.gray400}
                  style={{ marginLeft: 3 }}
                  accessibilityLabel="Sending"
                />
              </>
            ) : (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={13}
                color={item.read ? colors.accent : colors.gray400}
                accessibilityLabel={item.read ? 'Read' : 'Sent'}
              />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }, [colors, styles, navigation, handleRetryFailed]);

  const statusText = isTyping ? 'typing…' : (peer.online ? 'Active now' : 'Active recently');

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 10 : 0}
      >
        {/* Header — back · avatar + name/status (opens ProfileDetail) ·
            overflow safety menu. */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerProfile}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ProfileDetail', { profile: peer })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${peer.name || 'profile'}`}
          >
            <Image source={imageSource(peer.images?.[0])} style={styles.headerAvatar} />
            {/* Name over status only — the design's thread header
                carries no verification badge; it lives on the person
                detail this block opens. */}
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>{peer.name || 'Chat'}</Text>
              <Text style={styles.headerStatus}>{statusText}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleHeaderMenu}
            style={styles.headerMenuBtn}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.gray500} />
          </TouchableOpacity>
        </View>

        {/* Scam-pattern notice. Renders only when the server-side
            detector returns medium/high risk for this conversation. */}
        <ChatScamBanner
          verdict={scamVerdict}
          onDismiss={() => {
            scamDismissedRef.current = true;
            setScamVerdict(null);
          }}
          onLearnMore={() => {
            navigation.navigate('SettingsInfo', { pageKey: 'safety' });
          }}
        />

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={listItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Composer — 44px field + 44px gold send square, hairline on
            top of the bar. Text in, send out; nothing else. */}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 14 }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Message…"
            placeholderTextColor={colors.gray400}
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
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !inputText.trim() }}
            testID="chat-send"
            onPress={handleSend}
            disabled={!inputText.trim()}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          >
            <Ionicons name="send" size={19} color={colors.onGold} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {surveyNudge}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  // Square avatar tile with a hairline border — never a circle.
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.creamDark,
  },
  headerName: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    color: colors.black,
  },
  headerStatus: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: colors.gray400,
  },
  headerMenuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Design: padding 16px 14px, 8px between rows.
  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
  },

  // ── Day divider ──
  dayDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dayLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  dayLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.gray400,
  },
  textOnlyNote: {
    textAlign: 'center',
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: colors.gray400,
    marginBottom: 6,
  },
  textOnlyLink: {
    color: colors.accentDark,
    fontFamily: FontFamily.medium,
  },

  // ── Bubbles ──
  messageRow: {
    maxWidth: '75%',
  },
  myRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  theirRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  // --shadow-sm. The dark palette raises it to rgba(0,0,0,.35) —
  // a 6% shadow is invisible against the dark page.
  bubble: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.35 : 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  // Both bubbles carry the same 1px border box (the design gives mine
  // `border:1px solid transparent`) so a pair of bubbles with the same
  // text measures the same width.
  myBubble: {
    backgroundColor: colors.ssInk,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    borderRadius: 9,
    borderBottomRightRadius: 2,
  },
  // colors.creamDark is NOT the design's --color-surface in dark mode
  // (#10161D, darker than the page) — inputBg is the token that holds
  // #F4F1EA / #1F2833, which is what the design's surface resolves to
  // in both palettes.
  theirBubble: {
    backgroundColor: colors.inputBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 9,
    borderBottomLeftRadius: 2,
  },
  myBubbleText: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.onInk,
  },
  theirBubbleText: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.black,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    paddingHorizontal: 2,
  },
  metaText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: colors.gray400,
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: colors.error,
  },
  failedText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: colors.error,
  },
  // Legacy attachment placeholder — muted, deliberately not styled
  // like a live message.
  unsupportedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unsupportedText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: colors.gray400,
    fontStyle: 'italic',
  },

  // ── Composer ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.cream,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.inputBg,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: colors.black,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: colors.ssGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
