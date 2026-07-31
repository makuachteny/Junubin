// JuNubin — Message Requests
//
// The inbox for people who aren't connected to you yet. A stranger
// can't DM you outright: they send a request with a short note, and it
// lands here for you to accept or decline.
//
// Route name:   'MessageRequests'
// Route params: none required.
//               { initialTab?: 'received' | 'sent' }  — defaults to 'received'
// On accept:    navigates to 'Chat' with { conversationId, match: <profile> }
//
// Declining is deliberately quiet — the sender is never told, and the
// row stays on the server as `declined` so the same person can't
// re-send. Blocking stays a separate, stronger action reachable from
// the sender's profile.

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Typography, FontFamily, Layout } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useAuth } from '../auth';
import * as messageRequestService from '../api/services/messageRequestService';
import EmptyState from '../components/EmptyState';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import UnderlineTabs from '../components/UnderlineTabs';
import { useNetworkStatus } from '../utils/useNetworkStatus';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { useAccessibilityPreferences } from '../accessibility';

const TABS = ['Received', 'Sent'];

// The service returns every request regardless of status so the sender
// can see what happened to theirs. The Received tab only ever shows
// what still needs a decision — accepted ones live in the inbox as
// real conversations, declined ones are intentionally not resurfaced.
const isPending = (r) => r?.status === 'pending';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function MessageRequestsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { prefs } = useAccessibilityPreferences();
  const styles = useMemo(() => getStyles(colors, isDark, prefs), [colors, isDark, prefs]);
  const { session } = useAuth();
  const { isConnected } = useNetworkStatus();

  const initialTab = route?.params?.initialTab === 'sent' ? 'Sent' : 'Received';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  // Ids currently mid-accept / mid-decline. Keeps the row's buttons
  // inert so a double-tap can't fire two accepts (the RPC is
  // idempotent, but the second navigation would stack two Chat screens).
  const [busyIds, setBusyIds] = useState(() => new Set());

  const setBusy = useCallback((id, on) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const fetchRequests = useCallback(async () => {
    if (!session) {
      setIncoming([]);
      setOutgoing([]);
      setIsLoading(false);
      return;
    }
    // Both calls are independent — one failing shouldn't blank the
    // other tab, so settle them separately and only surface the error
    // banner when we got nothing at all.
    const [inRes, outRes] = await Promise.allSettled([
      messageRequestService.getIncomingRequests(),
      messageRequestService.getOutgoingRequests(),
    ]);
    if (inRes.status === 'fulfilled') setIncoming(inRes.value || []);
    if (outRes.status === 'fulfilled') setOutgoing(outRes.value || []);
    if (inRes.status === 'rejected' && outRes.status === 'rejected') {
      setError(isConnected ? 'Could not load your requests.' : 'You are offline.');
    } else {
      setError(null);
    }
    setIsLoading(false);
  }, [session, isConnected]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Re-pull on focus so accepting a request on another device, or
  // coming back from the Chat we just opened, leaves a correct list.
  useFocusEffect(
    useCallback(() => {
      if (session) fetchRequests();
    }, [session, fetchRequests]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests().finally(() => setRefreshing(false));
  }, [fetchRequests]);

  const handleAccept = useCallback(async (request) => {
    if (busyIds.has(request.id)) return;
    hapticMedium();
    setBusy(request.id, true);
    try {
      const { conversationId } = await messageRequestService.acceptMessageRequest(request.id);
      // Drop the row locally so the list is correct even if the
      // focus-refetch hasn't landed by the time the user comes back.
      setIncoming((prev) => prev.filter((r) => r.id !== request.id));
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
            setBusy(request.id, true);
            try {
              await messageRequestService.declineMessageRequest(request.id);
              setIncoming((prev) => prev.filter((r) => r.id !== request.id));
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

  const openProfile = useCallback((profile) => {
    if (!profile) return;
    navigation.navigate('ProfileDetail', { profile });
  }, [navigation]);

  const pendingIncoming = useMemo(() => incoming.filter(isPending), [incoming]);
  const data = activeTab === 'Received' ? pendingIncoming : outgoing;

  const renderIncoming = useCallback(({ item }) => {
    const person = item.from || {};
    const busy = busyIds.has(item.id);
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardHead}
          activeOpacity={0.75}
          onPress={() => openProfile(person)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${person.name || 'profile'}`}
        >
          <Image source={imageSource(person.images?.[0])} style={styles.avatar} />
          <View style={styles.headText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{person.name || 'Someone'}</Text>
              {person.verified && (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.accent}
                  accessibilityLabel="Verified profile"
                />
              )}
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {[person.city, timeAgo(item.createdAt)].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </TouchableOpacity>

        {item.message ? (
          <Text style={styles.note} numberOfLines={4}>{item.message}</Text>
        ) : (
          <Text style={[styles.note, styles.notePlaceholder]}>No note</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.declineBtn, busy && styles.btnBusy]}
            onPress={() => handleDecline(item)}
            disabled={busy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Decline request from ${person.name || 'this person'}`}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptBtn, busy && styles.btnBusy]}
            onPress={() => handleAccept(item)}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Accept request from ${person.name || 'this person'}`}
            accessibilityState={{ disabled: busy }}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [styles, colors, busyIds, handleAccept, handleDecline, openProfile]);

  const renderOutgoing = useCallback(({ item }) => {
    const person = item.to || {};
    const statusLabel = item.status === 'pending' ? 'Waiting'
      : item.status === 'accepted' ? 'Accepted'
      : item.status === 'declined' ? 'Not accepted'
      : item.status;
    return (
      <TouchableOpacity
        style={styles.sentRow}
        activeOpacity={0.75}
        onPress={() => {
          if (item.status === 'accepted' && item.conversationId) {
            navigation.navigate('Chat', {
              conversationId: item.conversationId,
              match: { ...person, conversationId: item.conversationId },
            });
            return;
          }
          openProfile(person);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${person.name || 'Someone'}, request ${statusLabel.toLowerCase()}`}
      >
        <Image source={imageSource(person.images?.[0])} style={styles.avatarSm} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{person.name || 'Someone'}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.message || 'No note'}
          </Text>
        </View>
        <View style={[
          styles.statusPill,
          item.status === 'accepted' && styles.statusPillAccepted,
        ]}>
          <Text style={[
            styles.statusPillText,
            item.status === 'accepted' && styles.statusPillTextAccepted,
          ]}>
            {statusLabel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [styles, navigation, openProfile]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={Layout.headerBackIconSize} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Message requests</Text>
        <View style={{ width: 30 }} />
      </View>

      <View style={styles.tabWrap}>
        <UnderlineTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </View>

      {!isConnected && (
        <View style={styles.offlineBar} accessibilityLiveRegion="polite">
          <Ionicons name="cloud-offline-outline" size={14} color={colors.gray600} />
          <Text style={styles.offlineText}>You're offline — showing the last list we loaded.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.loadingWrap}>
          <EmptyState
            icon="alert-circle-outline"
            title="Something went wrong"
            subtitle={error}
            actionLabel="Try again"
            onAction={() => { setIsLoading(true); fetchRequests(); }}
          />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={activeTab === 'Received' ? renderIncoming : renderOutgoing}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="mail-open-outline"
              title={activeTab === 'Received' ? 'No requests right now' : 'You have not sent any'}
              subtitle={
                activeTab === 'Received'
                  ? 'When someone who is not connected to you asks to start a conversation, it will wait here.'
                  : 'Requests you send to people you are not connected with will show up here until they answer.'
              }
            />
          }
        />
      )}
    </View>
  );
}

const getStyles = (colors, isDark, prefs = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Layout.headerHeight,
  },
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.sectionTitle,
    color: colors.black,
  },
  tabWrap: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  offlineText: {
    ...Typography.caption,
    color: colors.gray600,
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },

  // ─── Received: a card per request so the note has room ───
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray300,
  },
  avatarSm: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.gray300,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    ...Typography.bodySmallMedium,
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.black,
  },
  meta: {
    ...Typography.caption,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
  },
  note: {
    ...Typography.bodySmall,
    color: colors.black,
    lineHeight: 20,
  },
  notePlaceholder: {
    fontStyle: 'italic',
    color: colors.gray500,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  // Both actions clear 44pt so the destructive one isn't the easier tap.
  declineBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray300,
  },
  declineText: {
    ...Typography.label,
    fontSize: 14,
    color: colors.gray600,
  },
  acceptBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  acceptText: {
    ...Typography.label,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnBusy: {
    opacity: 0.6,
  },

  // ─── Sent: compact rows, status on the right ───
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: prefs?.largerTouchTargets ? 14 : 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  },
  statusPillAccepted: {
    backgroundColor: colors.accent,
  },
  statusPillText: {
    ...Typography.captionBold,
    fontSize: 11,
    color: colors.gray600,
  },
  statusPillTextAccepted: {
    color: '#FFFFFF',
  },
});
