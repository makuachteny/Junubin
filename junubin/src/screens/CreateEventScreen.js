// AnaJunubin — Create Event Screen
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from '../components/Button';
import { useCurrentUser } from '../hooks';
import { saveEvent } from '../utils/eventStore';

export default function CreateEventScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { currentUser } = useCurrentUser();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [ticketPrice, setTicketPrice] = useState('');
  const [ticketsTotal, setTicketsTotal] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please give your event a name.');
      return;
    }
    // Validate ticket price for paid events — must be a non-negative number.
    let parsedPrice = 0;
    if (!isFree) {
      parsedPrice = parseFloat(ticketPrice);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        Alert.alert('Invalid Ticket Price', 'Enter a non-negative number for ticket price.');
        return;
      }
    }
    const parsedTickets = Math.max(parseInt(ticketsTotal || '0', 10) || 0, 0);
    const created = {
      id: `evt_${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Join us for this event.',
      location: location.trim() || 'TBD',
      city: city.trim() || 'All',
      category: category.trim() || 'Social',
      date: date.trim() || '2026-01-01',
      time: time.trim() || '7:00 PM',
      isFree,
      ticketPrice: isFree ? 0 : parsedPrice,
      ticketsTotal: isFree ? null : parsedTickets,
      ticketsRemaining: isFree ? null : parsedTickets,
      attendees: 0,
      organizerId: currentUser?.id || 'org_1',
      organizerName: currentUser?.name || 'Organizer',
    };
    try {
      await saveEvent(created);
    } catch (err) {
      Alert.alert('Could not create event', err?.message || 'Try again in a moment.');
      return;
    }
    Alert.alert('Event Created!', `"${created.title}" has been published. Others can now RSVP.`);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Event Name</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g., Junubin Mixer" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="What's the event about?" placeholderTextColor={colors.gray400} multiline />

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="e.g., Juba Grand Hotel" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>City</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g., Juba" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g., Cultural" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>Date</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.gray400} />

        <Text style={styles.label}>Time</Text>
        <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="e.g., 7:00 PM" placeholderTextColor={colors.gray400} />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Free Event</Text>
          <TouchableOpacity
            style={[styles.togglePill, !isFree && styles.togglePillOff]}
            onPress={() => setIsFree((p) => !p)}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleDot, !isFree && styles.toggleDotOff]} />
          </TouchableOpacity>
        </View>

        {!isFree && (
          <>
            <Text style={styles.label}>Ticket Price (USD)</Text>
            <TextInput
              style={styles.input}
              value={ticketPrice}
              onChangeText={setTicketPrice}
              placeholder="e.g., 15"
              placeholderTextColor={colors.gray400}
              keyboardType="decimal-pad"
            />
            <Text style={styles.label}>Tickets Available</Text>
            <TextInput
              style={styles.input}
              value={ticketsTotal}
              onChangeText={setTicketsTotal}
              placeholder="e.g., 100"
              placeholderTextColor={colors.gray400}
              keyboardType="number-pad"
            />
          </>
        )}

        <View style={{ height: 24 }} />
        <Button title="Create Event" variant="primary" size="lg" fullWidth onPress={handleCreate} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.black,
    color: colors.black,
    letterSpacing: 0.3,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  label: {
    ...Typography.captionBold,
    color: colors.black,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FontFamily.medium,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  toggleLabel: {
    ...Typography.captionBold,
    color: colors.black,
  },
  togglePill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#009739',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  togglePillOff: {
    backgroundColor: colors.gray300,
  },
  toggleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-end',
  },
  toggleDotOff: {
    alignSelf: 'flex-start',
  },
});
