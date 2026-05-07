// AnaJunubin — Event Detail Screen
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import Button from '../components/Button';
import { useSubscription } from '../payments';
import CoinPurchaseSheet from '../components/CoinPurchaseSheet';
import { useCurrentUser } from '../hooks';
import {
  getAttendees,
  getEventStats,
  isAttending as isAttendingStored,
  registerFree,
  purchaseTicket,
  cancelRegistration,
  withdraw,
} from '../utils/eventStore';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function EventDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const event = route.params?.event || {};
  const [isAttending, setIsAttending] = useState(false);
  const [showCoinSheet, setShowCoinSheet] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [stats, setStats] = useState({ attendeesCount: event.attendees || 0, ticketsSold: 0, revenue: 0, withdrawn: 0, available: 0 });
  const { coins, consumeCoins } = useSubscription();
  const { currentUser } = useCurrentUser();

  const isFree = event.isFree !== false;
  const ticketPrice = event.ticketPrice || 0;
  const ticketsRemaining = event.ticketsRemaining ?? 0;
  const isOrganizer = event.organizerId && currentUser?.id && event.organizerId === currentUser.id;

  useEffect(() => {
    (async () => {
      const attending = await isAttendingStored(event.id, currentUser?.id);
      setIsAttending(attending);
      const list = await getAttendees(event.id);
      setAttendees(list);
      const s = await getEventStats(event.id);
      setStats(s);
    })();
  }, [event.id, currentUser?.id]);

  const goToTicket = (attendee) => {
    navigation.navigate('Ticket', { event, attendee });
  };

  const handleRSVP = async () => {
    if (isAttending) {
      await cancelRegistration(event.id, currentUser?.id);
      setIsAttending(false);
      const list = await getAttendees(event.id);
      setAttendees(list);
      setStats(await getEventStats(event.id));
      Alert.alert('Cancelled', 'You\'ve cancelled your RSVP.');
      return;
    }
    const result = await registerFree(event.id, currentUser);
    setIsAttending(true);
    const list = await getAttendees(event.id);
    setAttendees(list);
    setStats(await getEventStats(event.id));
    Alert.alert(
      "You're in!",
      `You're attending "${event.title}". Your ticket is saved to your profile.`,
      [
        { text: 'View Ticket', onPress: () => goToTicket(result.attendee) },
        { text: 'OK', style: 'cancel' },
      ],
    );
  };

  const handleBuyTicket = () => {
    if (isAttending) {
      cancelRegistration(event.id, currentUser?.id).then(async () => {
        setIsAttending(false);
        setAttendees(await getAttendees(event.id));
        setStats(await getEventStats(event.id));
        Alert.alert('Cancelled', 'You\'ve cancelled your ticket.');
      });
      return;
    }
    if (ticketsRemaining <= 0) {
      Alert.alert('Sold Out', 'Sorry, there are no tickets remaining for this event.');
      return;
    }
    Alert.alert(
      'Confirm Purchase',
      `Buy a ticket for "${event.title}" for ${ticketPrice} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Ticket',
          onPress: () => {
            const success = consumeCoins(ticketPrice);
            if (success) {
              purchaseTicket(event.id, currentUser, ticketPrice).then(async (result) => {
                setIsAttending(true);
                setAttendees(await getAttendees(event.id));
                setStats(await getEventStats(event.id));
                Alert.alert(
                  'Ticket Purchased!',
                  `You're attending "${event.title}". Your ticket is saved to your profile.`,
                  [
                    { text: 'View Ticket', onPress: () => goToTicket(result.attendee) },
                    { text: 'OK', style: 'cancel' },
                  ],
                );
              });
            } else {
              setShowCoinSheet(true);
            }
          },
        },
      ]
    );
  };

  const buttonTitle = isAttending
    ? 'Cancel RSVP'
    : isFree
      ? 'RSVP \u2014 Free'
      : `Buy Ticket \u2014 $${ticketPrice}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{event.title}</Text>

        {/* Ticket price badge */}
        <View style={[styles.priceBadge, isFree ? styles.priceBadgeFree : styles.priceBadgePaid]}>
          <Ionicons name={isFree ? 'gift-outline' : 'ticket-outline'} size={18} color={isFree ? '#2e7d32' : colors.accent} />
          <Text style={[styles.priceText, isFree ? styles.priceTextFree : styles.priceTextPaid]}>
            {isFree ? 'Free Event' : `$${ticketPrice.toFixed(2)}`}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <View>
              <Text style={styles.infoLabel}>{formatDate(event.date)}</Text>
              <Text style={styles.infoSub}>{event.time}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={colors.accent} />
            <Text style={styles.infoLabel}>{event.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color={colors.accent} />
            <Text style={styles.infoLabel}>{stats.attendeesCount} attending</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="ticket-outline" size={20} color={ticketsRemaining <= 10 ? '#d32f2f' : colors.accent} />
            <Text style={[styles.infoLabel, ticketsRemaining <= 10 && { color: '#d32f2f' }]}>
              {ticketsRemaining <= 0 ? 'Sold out' : `${ticketsRemaining} tickets left`}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{event.description}</Text>

        {isOrganizer && (
          <View style={styles.organizerCard}>
            <Text style={styles.sectionTitle}>Organizer</Text>
            <View style={styles.orgRow}>
              <Text style={styles.orgLabel}>Total Sales</Text>
              <Text style={styles.orgValue}>${stats.revenue.toFixed(2)}</Text>
            </View>
            <View style={styles.orgRow}>
              <Text style={styles.orgLabel}>Available</Text>
              <Text style={styles.orgValue}>${stats.available.toFixed(2)}</Text>
            </View>
            <View style={styles.orgRow}>
              <Text style={styles.orgLabel}>Withdrawn</Text>
              <Text style={styles.orgValue}>${stats.withdrawn.toFixed(2)}</Text>
            </View>
            <Button
              title="Withdraw to Account"
              variant="outline"
              size="md"
              fullWidth
              onPress={async () => {
                if (stats.available <= 0) {
                  Alert.alert('No Funds', 'There are no available funds to withdraw yet.');
                  return;
                }
                await withdraw(event.id, stats.available);
                setStats(await getEventStats(event.id));
                Alert.alert('Withdrawal Initiated', 'Funds have been transferred to your account.');
              }}
            />
            <Text style={styles.sectionTitle}>Attendees</Text>
            {attendees.length === 0 ? (
              <Text style={styles.emptyText}>No attendees yet.</Text>
            ) : attendees.map((a) => (
              <View key={a.id} style={styles.attendeeRow}>
                <Text style={styles.attendeeName}>{a.name}</Text>
                <Text style={styles.attendeeMeta}>{a.paid ? `$${a.amount}` : 'Free'}</Text>
              </View>
            ))}
          </View>
        )}

        <Button
          title={buttonTitle}
          variant={isAttending ? 'outline' : 'primary'}
          size="lg"
          fullWidth
          onPress={isFree ? handleRSVP : handleBuyTicket}
        />
      </ScrollView>
      <CoinPurchaseSheet visible={showCoinSheet} onClose={() => setShowCoinSheet(false)} />
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
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { ...Typography.h2, color: colors.black, marginTop: 8, marginBottom: 12 },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  priceBadgeFree: { backgroundColor: '#e8f5e9' },
  priceBadgePaid: { backgroundColor: isDark ? 'rgba(206,17,38,0.15)' : '#fce4ec' },
  priceText: { fontSize: 16, fontFamily: FontFamily.bold },
  priceTextFree: { color: '#2e7d32' },
  priceTextPaid: { color: colors.accent },
  infoCard: {
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 16,
    gap: 14,
    marginBottom: 20,
    ...getShadow('sm', isDark),
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoLabel: { ...Typography.body, color: colors.black },
  infoSub: { ...Typography.caption, color: colors.gray, marginTop: 2 },
  sectionTitle: { ...Typography.sectionTitle, color: colors.black, marginBottom: 8 },
  description: { ...Typography.body, color: colors.gray, lineHeight: 24, marginBottom: 24 },
  organizerCard: {
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.separator,
    padding: 16,
    gap: 10,
    marginBottom: 20,
    ...getShadow('sm', isDark),
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orgLabel: {
    ...Typography.caption,
    color: colors.gray,
  },
  orgValue: {
    ...Typography.bodySemibold,
    color: colors.black,
  },
  attendeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  attendeeName: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  attendeeMeta: {
    ...Typography.caption,
    color: colors.gray,
  },
  emptyText: {
    ...Typography.caption,
    color: colors.gray,
  },
});
