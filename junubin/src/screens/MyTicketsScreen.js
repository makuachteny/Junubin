// JuNubin — My Tickets
//
// Lists every event the current user has RSVP'd / paid for, newest first.
// Each row is a tappable preview that drills into the full TicketScreen.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { getMyTickets } from '../utils/eventStore';
import { useCurrentUser } from '../hooks';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function MyTicketsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentUser } = useCurrentUser();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const list = await getMyTickets(currentUser?.id);
    setTickets(list);
    setLoaded(true);
  }, [currentUser?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-fetch when the screen regains focus — covers the case where the user
  // RSVPs from EventDetail and pops back here.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const renderItem = ({ item }) => {
    const { event, attendee } = item;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('Ticket', { event, attendee })}
        activeOpacity={0.85}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.dayMonth}>{formatDate(event.date)}</Text>
          <Text style={styles.time}>{event.time || 'TBA'}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.location} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color={colors.gray500} />
            {' '}{event.location || 'Location TBA'}
          </Text>
          <View style={styles.codeRow}>
            <Ionicons name={attendee.paid ? 'ticket' : 'gift-outline'} size={12} color={colors.accent} />
            <Text style={styles.codeText}>{attendee.ticketCode}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Tickets</Text>
        <View style={{ width: 26 }} />
      </View>

      {loaded && tickets.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ticket-outline" size={42} color={colors.gray400} />
          <Text style={styles.emptyTitle}>No tickets yet</Text>
          <Text style={styles.emptyBody}>
            RSVP to an event in Community and your ticket will appear here.
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => navigation.navigate('Events')}
          >
            <Text style={styles.emptyCtaText}>Browse events</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.attendee.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    ...Typography.screenTitle,
    color: colors.black,
  },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    ...getShadow('sm', isDark),
  },
  cardLeft: {
    width: 88,
    alignItems: 'flex-start',
    paddingRight: 12,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
  },
  dayMonth: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  time: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
  },
  cardBody: { flex: 1 },
  title: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  location: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeText: {
    fontSize: 12.5,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.accent,
    letterSpacing: 1,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    ...Typography.h3,
    color: colors.black,
    marginTop: 6,
  },
  emptyBody: {
    ...Typography.body,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  emptyCtaText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
