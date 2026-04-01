// AnaJunubin — Event Detail Screen
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import Button from '../components/Button';
import { useSubscription } from '../payments';
import CoinPurchaseSheet from '../components/CoinPurchaseSheet';

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
  const { coins, consumeCoins } = useSubscription();

  const isFree = event.isFree !== false;
  const ticketPrice = event.ticketPrice || 0;
  const ticketsRemaining = event.ticketsRemaining ?? 0;

  const handleRSVP = () => {
    setIsAttending(!isAttending);
    Alert.alert(
      isAttending ? 'Cancelled' : 'You\'re In!',
      isAttending ? 'You\'ve cancelled your RSVP.' : `You're attending "${event.title}". See you there!`
    );
  };

  const handleBuyTicket = () => {
    if (isAttending) {
      setIsAttending(false);
      Alert.alert('Cancelled', 'You\'ve cancelled your ticket.');
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
              setIsAttending(true);
              Alert.alert('Ticket Purchased!', `You're attending "${event.title}". See you there!`);
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
        <TouchableOpacity onPress={() => Share.share({ message: `Check out "${event.title}" on JuNubin! ${event.date} at ${event.location}` }).catch(() => {})}>
          <Ionicons name="share-outline" size={22} color={colors.accent} />
        </TouchableOpacity>
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
            <Text style={styles.infoLabel}>{(event.attendees || 0) + (isAttending ? 1 : 0)} attending</Text>
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
  container: { flex: 1, backgroundColor: colors.white },
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
});
