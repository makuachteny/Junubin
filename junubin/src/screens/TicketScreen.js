// JuNubin — Ticket detail (printable + Apple Wallet)
//
// Stylised paper-stub: ink-on-cream colourway, refined typography, real
// scannable QR code on the bottom stub (image cached via expo-image, URL
// generated from api.qrserver.com), and an "Add to Apple Wallet" CTA that
// links to a Supabase Edge Function which returns a signed .pkpass.
//
// Apple Wallet flow requires the user to register an Apple Pass Type ID
// at developer.apple.com and upload the .p12 signing cert to Supabase
// secrets — see supabase/functions/event-ticket-pkpass/README.md. The
// button shows a clear message if the backend isn't configured yet.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { getMyAttendee } from '../utils/eventStore';
import { useCurrentUser } from '../hooks';
import { supabase } from '../config/supabase';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}, ${y}`;
}

// Public, free QR generator — produces a PNG; expo-image caches it on disk
// after the first fetch so the ticket stays scannable offline at the door.
function buildQrUrl(payload) {
  const encoded = encodeURIComponent(payload || '');
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encoded}`;
}

export default function TicketScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentUser } = useCurrentUser();
  const event = route.params?.event;
  const initialAttendee = route.params?.attendee || null;
  const [attendee, setAttendee] = useState(initialAttendee);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    if (initialAttendee || !event?.id || !currentUser?.id) return;
    let cancelled = false;
    (async () => {
      const found = await getMyAttendee(event.id, currentUser.id);
      if (!cancelled) setAttendee(found);
    })();
    return () => { cancelled = true; };
  }, [event?.id, currentUser?.id, initialAttendee]);

  const qrPayload = useMemo(() => {
    if (!event?.id || !attendee) return '';
    // Door staff scan this. Encodes everything they need to verify without
    // a network call: ticket code, attendee id, event id, app id.
    return `junubin://ticket?code=${attendee.ticketCode}&att=${attendee.id}&evt=${event.id}`;
  }, [event?.id, attendee]);

  const onAddToWallet = useCallback(async () => {
    if (!event?.id || !attendee?.id) return;
    setWalletLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('event-ticket-pkpass', {
        body: { eventId: event.id, attendeeId: attendee.id },
      });
      if (error) throw new Error(error.message || 'Wallet pass not available');
      if (!data?.url) throw new Error('No pass URL returned');
      // iOS detects the .pkpass MIME type and opens directly into Wallet.
      const supported = await Linking.canOpenURL(data.url);
      if (!supported) throw new Error('Could not open Apple Wallet');
      await Linking.openURL(data.url);
    } catch (err) {
      Alert.alert(
        'Apple Wallet',
        err?.message || 'Add to Wallet is not available yet. Your ticket code below works at the door.',
      );
    } finally {
      setWalletLoading(false);
    }
  }, [event?.id, attendee?.id]);

  const onShare = useCallback(async () => {
    if (!event || !attendee) return;
    try {
      await Share.share({
        message: `I'm going to ${event.title} on ${formatDate(event.date)} at ${event.location}. My JuNubin ticket: ${attendee.ticketCode}`,
      });
    } catch (e) {
      Alert.alert('Share Failed', e?.message || 'Could not share ticket.');
    }
  }, [event, attendee]);

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  if (!event || !attendee) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={colors.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ticket</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Ticket not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Ticket</Text>
        <TouchableOpacity onPress={onShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="share-outline" size={22} color={colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top stub — event info */}
        <View style={styles.topStub}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>JUNUBIN</Text>
            <View style={styles.brandDot} />
            <Text style={styles.brandKind}>{attendee.paid ? 'TICKET' : 'RSVP'}</Text>
          </View>

          <Text style={styles.eventTitle} numberOfLines={3}>{event.title}</Text>

          {event.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{event.category}</Text>
            </View>
          ) : null}

          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>WHEN</Text>
              <Text style={styles.metaValue}>{formatDate(event.date)}</Text>
              <Text style={styles.metaSub}>{event.time || 'TBA'}</Text>
            </View>
            <View style={styles.metaCellRight}>
              <Text style={styles.metaLabel}>WHERE</Text>
              <Text style={styles.metaValue} numberOfLines={2}>{event.location || 'TBA'}</Text>
              {event.city ? <Text style={styles.metaSub}>{event.city}</Text> : null}
            </View>
          </View>

          <View style={styles.attendeeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>ATTENDEE</Text>
              <Text style={styles.metaValue}>{attendee.name}</Text>
            </View>
            <View>
              <Text style={[styles.metaLabel, { textAlign: 'right' }]}>PRICE</Text>
              <Text style={[styles.metaValue, { textAlign: 'right' }]}>
                {attendee.paid ? `$${(attendee.amount || 0).toFixed(2)}` : 'Free'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notched perforation */}
        <View style={styles.perforation}>
          <View style={[styles.notch, styles.notchLeft]} />
          <View style={styles.dashedLine} />
          <View style={[styles.notch, styles.notchRight]} />
        </View>

        {/* Bottom stub — QR + ticket code */}
        <View style={styles.bottomStub}>
          <Text style={styles.codeLabel}>SHOW AT THE DOOR</Text>

          <View style={styles.qrFrame}>
            <ExpoImage
              source={{ uri: buildQrUrl(qrPayload) }}
              style={styles.qrImage}
              contentFit="contain"
              transition={120}
              cachePolicy="memory-disk"
              accessibilityLabel="Ticket QR code"
            />
          </View>

          <Text style={styles.code} selectable>
            {attendee.ticketCode}
          </Text>
          <Text style={styles.footnote}>
            Door staff scan the code or read the digits aloud. Don't share this image
            publicly — it's the only ticket on the door list.
          </Text>
        </View>

        {/* Apple Wallet CTA */}
        <TouchableOpacity
          style={styles.walletBtn}
          activeOpacity={0.85}
          onPress={onAddToWallet}
          disabled={walletLoading}
        >
          {walletLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.walletText}>Add to Apple Wallet</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.walletHint}>
          Save this ticket to Apple Wallet for offline access at the door.
        </Text>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    letterSpacing: -0.2,
  },
  content: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { ...Typography.body, color: colors.gray500 },

  // ── Top stub ─────────────────────────────────────────────
  topStub: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 26,
    ...getShadow('md', isDark),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  brand: {
    fontSize: 11,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    letterSpacing: 3.2,
    color: colors.accent,
  },
  brandDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray400,
  },
  brandKind: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: colors.gray500,
  },
  eventTitle: {
    fontSize: 30,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    color: colors.black,
    lineHeight: 35,
    letterSpacing: -0.8,
    marginBottom: 12,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,13,12,0.05)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 22,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: colors.gray600,
  },
  metaGrid: {
    flexDirection: 'row',
    paddingTop: 16,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  metaCell: { flex: 1.1, paddingRight: 12 },
  metaCellRight: { flex: 1, paddingLeft: 4 },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  metaLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.gray500,
    marginBottom: 5,
  },
  metaValue: {
    fontSize: 15.5,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.black,
    lineHeight: 21,
    letterSpacing: -0.1,
  },
  metaSub: {
    fontSize: 12.5,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    marginTop: 3,
  },

  // ── Perforation ───────────────────────────────────────────
  perforation: {
    height: 22,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  notch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: 'absolute',
    top: 0,
    backgroundColor: colors.surfaceMuted,
    zIndex: 2,
  },
  notchLeft: { left: -11 },
  notchRight: { right: -11 },
  dashedLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.separator,
    marginHorizontal: 16,
  },

  // ── Bottom stub ───────────────────────────────────────────
  bottomStub: {
    backgroundColor: colors.cardBg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 26,
    alignItems: 'center',
    ...getShadow('md', isDark),
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.gray500,
    marginBottom: 16,
  },
  qrFrame: {
    width: 220,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  qrImage: { width: '100%', height: '100%' },
  code: {
    fontSize: 24,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    letterSpacing: 4,
    color: colors.black,
    marginBottom: 14,
  },
  footnote: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 6,
  },

  // ── Wallet CTA ────────────────────────────────────────────
  walletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
    minHeight: 50,
  },
  walletText: {
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  walletHint: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
    paddingHorizontal: 14,
  },
});
