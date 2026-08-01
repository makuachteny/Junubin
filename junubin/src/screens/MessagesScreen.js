// JuNubin — Chats (the app's home tab).
//
// Two segments in one surface:
//   Messages — the conversation inbox (accepted connections).
//   Requests — pending incoming message requests, rendered inline as
//              Blueprint cards with Accept / Decline. Requests live
//              here and only here — there is no standalone requests
//              screen in the redesign.
//
// Accept runs the accept_message_request flow, then opens the new
// Chat. Declining is silent.

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import { mockMatches, mockLikes } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import * as matchesService from '../api/services/matchesService';
import * as messageRequestService from '../api/services/messageRequestService';
import { useRealtime } from '../api/hooks/useRealtime';
import MessageListSkeleton from '../components/MessageListSkeleton';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import Blueprint from '../components/Blueprint';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { useAccessibilityPreferences } from '../accessibility';

// Demo-mode fallback. When DEMO_DATA_ENABLED is true (TestFlight
// launch period), the inbox is seeded with mock data so testers have
// something to interact with before real users sign up. Flip the flag
// off in src/config/demoData.js before App Review submission.
// Module-scope so the arrays are referentially stable — they sit in
// fetchInbox's dependency chain.
const DEMO_MATCHES = DEMO_DATA_ENABLED ? mockMatches : [];
const DEMO_REQUEST_NOTES = [
  'Hey! We keep crossing paths in the community — would love to chat.',
  'Saw we speak the same languages. Coffee sometime?',
  'Your profile came up in the directory — can I say hi?',
];
const DEMO_REQUESTS = DEMO_DATA_ENABLED
  ? mockLikes.slice(0, 3).map((person, i) => ({
      id: `demo_req_${person.id}`,
      status: 'pending',
      from: person,
      message: DEMO_REQUEST_NOTES[i % DEMO_REQUEST_NOTES.length],
      createdAt: person.likedAt,
      __demo: true,
    }))
  : [];

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { prefs } = useAccessibilityPreferences();
  const styles = useMemo(() => getStyles(colors, isDark, prefs), [colors, isDark, prefs]);
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const { onInboxActivity } = useRealtime(currentUser?.id);
  const contentAnim = useRef(new Animated.Value(0)).current;
  const rowAnimsRef = useRef([]);
  const hasAnimatedRef = useRef(false);
  const loadingTimeoutRef = useRef(null);

  const [segment, setSegment] = useState('messages');
  const [matches, setMatches] = useState([]);
  // Pending incoming message requests, full request shape
  // ({ id, from, message, createdAt }) — same rows the MessageRequests
  // screen renders, shown inline here as the second segment.
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Ids currently mid-accept / mid-decline, so a double-tap can't fire
  // two accepts (same guard as MessageRequestsScreen).
  const [busyIds, setBusyIds] = useState(() => new Set());

  const setBusy = useCallback((id, on) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const fetchInbox = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      setMatches((prev) => (prev.length ? prev : DEMO_MATCHES));
      setRequests((prev) => (prev.length ? prev : DEMO_REQUESTS));
      setIsLoading(false);
    }, 600);

    if (!session) {
      setMatches(DEMO_MATCHES);
      setRequests(DEMO_REQUESTS);
      setIsLoading(false);
      return Promise.resolve();
    }
    return Promise.all([
      matchesService.getMatches().then((apiMatches) => {
        setMatches(apiMatches.length > 0 ? apiMatches : DEMO_MATCHES);
      }),
      messageRequestService.getIncomingRequests().then((rows) => {
        const pending = (rows || []).filter((r) => r.status === 'pending' && r.from);
        setRequests(pending.length > 0 ? pending : DEMO_REQUESTS);
      }),
    ]).catch((err) => {
      if (__DEV__) console.warn('Chats fetch failed:', err);
      setMatches(DEMO_MATCHES);
      setRequests(DEMO_REQUESTS);
    }).finally(() => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);
    });
  }, [session]);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  // Re-fetch on tab focus too. Handles the "another device accepted /
  // blocked while this screen was backgrounded" case where the
  // realtime sub may have missed the event.
  useFocusEffect(
    useCallback(() => {
      if (session) fetchInbox();
    }, [session, fetchInbox]),
  );

  // Realtime: any inbox activity — a new Message row or a
  // MessageRequest insert/update — refetches both segments.
  useEffect(() => {
    if (!session) return;
    const unsub = onInboxActivity(() => {
      fetchInbox();
    });
    return unsub;
  }, [session, onInboxActivity, fetchInbox]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInbox().finally(() => setRefreshing(false));
  }, [fetchInbox]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  const requestCount = requests.length;
  const unreadTotal = useMemo(
    () => matches.reduce(
      (acc, m) => acc + (typeof m.unreadCount === 'number' ? m.unreadCount : (m.unread ? 1 : 0)),
      0,
    ),
    [matches],
  );

  // Tab-bar badge on the Chats tab: unread messages + pending requests.
  // tabBarBadgeStyle (accent pill) lives in AppNavigator's screenOptions.
  useEffect(() => {
    const total = unreadTotal + requestCount;
    navigation.setOptions?.({
      tabBarBadge: total > 0 ? (total > 99 ? '99+' : total) : undefined,
    });
  }, [navigation, unreadTotal, requestCount]);

  const handleMatchPress = (match) => {
    navigation.navigate('Chat', { match });
  };

  const openProfile = useCallback((profile) => {
    if (!profile) return;
    navigation.navigate('ProfileDetail', { profile });
  }, [navigation]);

  // Accept — same flow as MessageRequestsScreen: accept_message_request
  // RPC, then straight into the new conversation. Demo rows have no
  // server request, so they just convert locally.
  const handleAccept = useCallback(async (request) => {
    if (busyIds.has(request.id)) return;
    hapticMedium();
    if (request.__demo) {
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      navigation.navigate('Chat', { match: request.from });
      return;
    }
    setBusy(request.id, true);
    try {
      const { conversationId } = await messageRequestService.acceptMessageRequest(request.id);
      // Drop the row locally so the list is correct even if the
      // focus-refetch hasn't landed by the time the user comes back.
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      navigation.navigate('Chat', {
        conversationId,
        match: { ...request.from, conversationId },
      });
    } catch (e) {
      Alert.alert('Could not accept', e?.message || 'Try again in a moment.');
    } finally {
      setBusy(request.id, false);
    }
  }, [busyIds, navigation, setBusy]);

  const handleDecline = useCallback((request) => {
    if (busyIds.has(request.id)) return;
    const name = request.from?.name || 'this person';
    Alert.alert(
      `Decline ${name}?`,
      "They won't be told, and they won't be able to send you another request. You can still block or report them from their profile.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            hapticLight();
            if (request.__demo) {
              setRequests((prev) => prev.filter((r) => r.id !== request.id));
              return;
            }
            setBusy(request.id, true);
            try {
              await messageRequestService.declineMessageRequest(request.id);
              setRequests((prev) => prev.filter((r) => r.id !== request.id));
            } catch (e) {
              Alert.alert('Could not decline', e?.message || 'Try again in a moment.');
            } finally {
              setBusy(request.id, false);
            }
          },
        },
      ],
    );
  }, [busyIds, setBusy]);

  // Conversations sort by recency. (The old mode-aware 'dating'/'social'
  // float-to-top sort is dead post-pivot — the app has one mode now.)
  const conversationData = useMemo(
    () => matches.slice().sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
    ),
    [matches],
  );

  // Build row animation values when conversation data changes (only first render)
  useEffect(() => {
    if (hasAnimatedRef.current || conversationData.length === 0) return;
    const anims = conversationData.map(() => new Animated.Value(0));
    rowAnimsRef.current = anims;
    hasAnimatedRef.current = true;
    const staggered = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        delay: i * 45,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, staggered).start();
  }, [conversationData]);

  // ─── Messages segment row ───
  const renderConversation = useCallback(({ item, index }) => {
    const rowAnim = rowAnimsRef.current[index];
    const animStyle = rowAnim ? {
      opacity: rowAnim,
      transform: [{
        translateY: rowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      }],
    } : {};

    // Source of truth is the server-derived `unreadCount`
    // (matchesService computes it from Message.readAt). The local
    // `unread` boolean stays as a fallback for unmigrated paths.
    const unreadCount = typeof item.unreadCount === 'number' ? item.unreadCount : (item.unread ? 1 : 0);
    const isUnread = unreadCount > 0 || !!item.unread;
    const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);
    const isOnline = !!(item.online || item.isOnline);
    // "You: " prefix when the last message in the thread is mine.
    // matchesService exposes `lastMessageMine`; absent (cached rows
    // from before the field existed) we just omit the prefix.
    const preview = item.lastMessage
      ? `${item.lastMessageMine ? 'You: ' : ''}${item.lastMessage}`
      : '';

    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={styles.messageRow}
          onPress={() => handleMatchPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, ${isUnread ? `${unreadCount || 1} unread message${(unreadCount || 1) === 1 ? '' : 's'}` : 'conversation'}` : item.name}
        >
          {isUnread && <View style={styles.unreadBar} />}
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={(e) => {
              e.stopPropagation?.();
              // Avatar tap opens the full profile rather than the thread,
              // so users can review who they're about to talk to.
              openProfile(item);
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}'s profile`}
          >
            <Image source={imageSource(item.images?.[0])} style={styles.avatar} />
            {isOnline && <View style={styles.onlineDot} />}
          </TouchableOpacity>
          <View style={styles.msgInfo}>
            <View style={styles.msgTopRow}>
              <Text style={styles.msgName} numberOfLines={1}>{item.name}</Text>
              {item.timestamp ? (
                <Text style={styles.msgTime}>{item.timestamp}</Text>
              ) : null}
            </View>
            <Text
              style={[
                styles.msgPreview,
                isUnread && styles.msgPreviewUnread,
                // Italicize the placeholder so it's visually distinct
                // from a real last-message preview.
                !item.lastMessage && styles.msgPreviewPlaceholder,
              ]}
              numberOfLines={1}
            >
              {preview || 'Say hi 👋'}
            </Text>
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>{badgeText}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [styles, prefs, openProfile]);

  // ─── Requests segment card ───
  const renderRequest = useCallback(({ item }) => {
    const person = item.from || {};
    const busy = busyIds.has(item.id);
    const nameLine = person.age ? `${person.name}, ${person.age}` : (person.name || 'Someone');
    const meta = [person.city || person.country, person.profession].filter(Boolean).join(' · ');
    return (
      <Blueprint style={styles.requestCard}>
        <View style={styles.requestHead}>
          <TouchableOpacity
            onPress={() => openProfile(person)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${person.name || 'profile'}`}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Image source={imageSource(person.images?.[0])} style={styles.requestAvatar} />
          </TouchableOpacity>
          <View style={styles.requestHeadText}>
            <Text style={styles.requestName} numberOfLines={1}>{nameLine}</Text>
            {meta ? <Text style={styles.requestMeta} numberOfLines={1}>{meta}</Text> : null}
          </View>
        </View>

        {item.message ? (
          <Text style={styles.requestNote} numberOfLines={4}>&ldquo;{item.message}&rdquo;</Text>
        ) : null}

        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.acceptBtn, busy && styles.btnBusy]}
            onPress={() => handleAccept(item)}
            disabled={busy}
            activeOpacity={0.85}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Accept request from ${person.name || 'this person'}`}
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.cream} />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.declineBtn, busy && styles.btnBusy]}
            onPress={() => handleDecline(item)}
            disabled={busy}
            activeOpacity={0.8}
            hitSlop={{ top: 4, bottom: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`Decline request from ${person.name || 'this person'}`}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </Blueprint>
    );
  }, [styles, colors, busyIds, handleAccept, handleDecline, openProfile]);

  const footerHint = (
    <Text style={styles.footerHint}>
      Start a chat from anyone's profile —{' '}
      <Text
        style={styles.footerHintLink}
        onPress={() => navigation.navigate('DirectoryTab')}
        accessibilityRole="link"
        accessibilityLabel="Browse the Directory"
      >
        browse the Directory
      </Text>
    </Text>
  );

  // There is no in-app notifications feed service yet (delivery is
  // push-only), so pending requests proxy for "unread notifications"
  // on the bell — same signal the design's dot carries.
  const hasNotifDot = requestCount > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <Animated.View
        style={[
          styles.headerBlock,
          {
            opacity: contentAnim,
            transform: [{
              translateY: contentAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.kickerRow}>
              {/* Mini flag mark: ink / red / green stripes in a hairline frame. */}
              <View style={styles.flagMark} accessible={false}>
                <View style={styles.flagStripeInk} />
                <View style={styles.flagStripeRed} />
                <View style={styles.flagStripeGreen} />
              </View>
              <Text style={styles.kicker}>JUNUBIN</Text>
            </View>
            <Text style={styles.headerTitle} accessibilityRole="header">Chats</Text>
          </View>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={hasNotifDot ? 'Notifications, new activity' : 'Notifications'}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.black} />
            {hasNotifDot && <View style={styles.bellDot} />}
          </TouchableOpacity>
        </View>

        {/* ─── Messages | Requests segmented control ─── */}
        <View style={styles.segmentWrap} accessibilityRole="tablist">
          <TouchableOpacity
            style={[styles.segmentBtn, segment === 'messages' && styles.segmentBtnActive]}
            onPress={() => setSegment('messages')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === 'messages' }}
            accessibilityLabel="Messages"
          >
            <Text style={[styles.segmentText, segment === 'messages' && styles.segmentTextActive]}>
              Messages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, styles.segmentBtnRight, segment === 'requests' && styles.segmentBtnActive]}
            onPress={() => setSegment('requests')}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: segment === 'requests' }}
            accessibilityLabel={requestCount > 0 ? `Requests, ${requestCount} pending` : 'Requests'}
          >
            <Text style={[styles.segmentText, segment === 'requests' && styles.segmentTextActive]}>
              {requestCount > 0 ? `Requests (${requestCount > 99 ? '99+' : requestCount})` : 'Requests'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Body ─── */}
      {isLoading ? (
        <View style={styles.listTopBorder}>
          <MessageListSkeleton />
        </View>
      ) : segment === 'messages' ? (
        <FlatList
          style={styles.listTopBorder}
          data={conversationData}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Find people in the community and say hello.</Text>
            </View>
          }
          ListFooterComponent={footerHint}
        />
      ) : (
        <FlatList
          style={styles.listTopBorder}
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.requestsContent}
          ItemSeparatorComponent={() => <View style={styles.requestGap} />}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <Text style={styles.requestsIntro}>
              People you're not connected to yet. Accepting starts a chat; declining is silent.
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.requestsEmpty}>
              No pending requests.{'\n'}Requests from strangers land here — never straight in your inbox.
            </Text>
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark, prefs = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },

  // ─── Header ───
  headerBlock: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  // 20×14 three-stripe flag mark; ink/red/green with hairline gaps in
  // the screen background so the stripes read separated, like the mock.
  flagMark: {
    width: 20,
    height: 14,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  flagStripeInk: {
    flex: 1,
    backgroundColor: colors.ssInk,
  },
  flagStripeRed: {
    flex: 1,
    backgroundColor: colors.ssRed,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.cream,
  },
  flagStripeGreen: {
    flex: 1,
    backgroundColor: colors.ssGreen,
  },
  kicker: {
    fontFamily: FontFamily.heading,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 2.7,
    color: colors.accentDark,
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: FontFamily.heading,
    fontSize: 31,
    lineHeight: 31,
    fontWeight: '600',
    color: colors.black,
  },
  bellBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ssRed,
  },

  // ─── Segmented control ───
  segmentWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    height: prefs?.largerTouchTargets ? 44 : 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  segmentBtnRight: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.separator,
  },
  segmentBtnActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 13.5,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.black,
  },
  segmentTextActive: {
    color: colors.cream,
  },

  // ─── Lists ───
  listTopBorder: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },

  // ─── Conversation rows ───
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 18,
    paddingVertical: prefs?.largerTouchTargets ? 16 : 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    position: 'relative',
  },
  // 3px flag-gold bar hugging the left edge of unread rows.
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    backgroundColor: colors.ssGold,
  },
  avatarWrap: {
    position: 'relative',
  },
  // Square 56px photo — the design language uses square frames with a
  // hairline border, never circles.
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: colors.gray300,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  onlineDot: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: colors.ssGreen,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  msgInfo: {
    flex: 1,
    minWidth: 0,
  },
  msgTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  msgName: {
    flexShrink: 1,
    fontFamily: FontFamily.heading,
    fontSize: 17.5,
    fontWeight: '600',
    color: colors.black,
  },
  msgTime: {
    fontSize: 11.5,
    fontFamily: FontFamily.regular,
    color: prefs?.highContrast ? colors.gray600 : colors.gray400,
    textAlign: 'right',
  },
  msgPreview: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
    marginTop: 2,
  },
  msgPreviewUnread: {
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  // Italic + muted so the "Say hi" CTA reads as a placeholder, not a
  // real message from the other person.
  msgPreviewPlaceholder: {
    fontStyle: 'italic',
    color: prefs?.highContrast ? colors.gray600 : colors.gray500,
  },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.cream,
  },

  // ─── Footer hint ───
  footerHint: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    textAlign: 'center',
    fontSize: 12.5,
    fontFamily: FontFamily.regular,
    color: prefs?.highContrast ? colors.gray600 : colors.gray500,
  },
  footerHintLink: {
    color: colors.accentDark,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // ─── Requests segment ───
  requestsContent: {
    padding: 18,
    paddingBottom: 40,
    flexGrow: 1,
  },
  requestsIntro: {
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: FontFamily.regular,
    color: prefs?.highContrast ? colors.gray600 : colors.gray500,
    marginBottom: 14,
  },
  requestGap: {
    height: 14,
  },
  requestCard: {
    backgroundColor: colors.cream,
    padding: 14,
    gap: 10,
  },
  requestHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  requestAvatar: {
    width: 46,
    height: 46,
    borderRadius: 0,
    backgroundColor: colors.gray300,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  requestHeadText: {
    flex: 1,
    minWidth: 0,
  },
  requestName: {
    fontFamily: FontFamily.heading,
    fontSize: 17,
    fontWeight: '600',
    color: colors.black,
  },
  requestMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: colors.gray600,
    marginTop: 1,
  },
  requestNote: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
    color: colors.black,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
    height: 38,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  acceptText: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.cream,
  },
  declineBtn: {
    flex: 1,
    height: 38,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  declineText: {
    fontSize: 13.5,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  btnBusy: {
    opacity: 0.6,
  },
  requestsEmpty: {
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
    color: prefs?.highContrast ? colors.gray600 : colors.gray500,
  },

  // ─── Empty conversations ───
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.black,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13.5,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 8,
  },
});
