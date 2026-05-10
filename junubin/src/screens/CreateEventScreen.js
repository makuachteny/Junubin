// AnaJunubin — Create Event Screen
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from '../components/Button';
import { useCurrentUser } from '../hooks';
import { saveEvent } from '../utils/eventStore';

// Date / time validation helpers — we don't have @react-native-community/datetimepicker
// installed and the brief forbids adding deps, so we keep TextInput entries but
// strictly validate + preview the parsed value. parseEventDate accepts YYYY-MM-DD,
// parseEventTime accepts H:MM (AM|PM) or 24h HH:MM; both return null on bad input.
const parseEventDate = (raw) => {
  const s = String(raw || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) return null;
  return d;
};

const parseEventTime = (raw) => {
  const s = String(raw || '').trim();
  // 12-hour with AM/PM: "7:00 PM", "07:30 am"
  const m12 = /^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/.exec(s);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const isPm = m12[3].toLowerCase() === 'p';
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (h === 12) h = 0;
    if (isPm) h += 12;
    return { hours: h, minutes: min };
  }
  // 24-hour: "19:00"
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return { hours: h, minutes: min };
  }
  return null;
};

const combineDateTime = (date, time) => {
  if (!date) return null;
  const d = new Date(date.getTime());
  if (time) {
    d.setHours(time.hours, time.minutes, 0, 0);
  } else {
    d.setHours(23, 59, 0, 0); // end-of-day fallback when only a date is given
  }
  return d;
};

const formatDatePreview = (date) => {
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatTimePreview = (time) => {
  if (!time) return null;
  const h12 = time.hours === 0 ? 12 : time.hours > 12 ? time.hours - 12 : time.hours;
  const ampm = time.hours >= 12 ? 'PM' : 'AM';
  const mm = String(time.minutes).padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
};

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
    // Date / time validation — reject empty, malformed, and past datetimes.
    const parsedDate = parseEventDate(date);
    if (!parsedDate) {
      Alert.alert('Invalid Date', 'Please enter the date as YYYY-MM-DD (e.g., 2026-06-15).');
      return;
    }
    const parsedTime = parseEventTime(time);
    if (time.trim() && !parsedTime) {
      Alert.alert('Invalid Time', 'Use H:MM AM/PM (e.g., 7:00 PM) or 24-hour HH:MM (e.g., 19:00).');
      return;
    }
    const eventStart = combineDateTime(parsedDate, parsedTime);
    if (!eventStart || eventStart.getTime() <= Date.now()) {
      Alert.alert('Date In The Past', 'Pick a date and time in the future.');
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
      date: date.trim(),
      time: time.trim() || (parsedTime ? formatTimePreview(parsedTime) : ''),
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
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.gray400}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
        />
        {date.trim().length > 0 ? (
          (() => {
            const parsed = parseEventDate(date);
            if (!parsed) {
              return <Text style={styles.previewError}>Use format YYYY-MM-DD.</Text>;
            }
            const isPast = parsed.getTime() < new Date().setHours(0, 0, 0, 0);
            return (
              <Text style={[styles.previewText, isPast && styles.previewError]}>
                {formatDatePreview(parsed)}{isPast ? '  (in the past)' : ''}
              </Text>
            );
          })()
        ) : null}

        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          value={time}
          onChangeText={setTime}
          placeholder="e.g., 7:00 PM or 19:00"
          placeholderTextColor={colors.gray400}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {time.trim().length > 0 ? (
          (() => {
            const parsedT = parseEventTime(time);
            if (!parsedT) {
              return <Text style={styles.previewError}>Use H:MM AM/PM or 24-hour HH:MM.</Text>;
            }
            return <Text style={styles.previewText}>{formatTimePreview(parsedT)}</Text>;
          })()
        ) : null}

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
  previewText: {
    ...Typography.caption,
    color: colors.gray,
    marginTop: 6,
    marginLeft: 4,
  },
  previewError: {
    ...Typography.caption,
    color: '#C62828',
    marginTop: 6,
    marginLeft: 4,
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
