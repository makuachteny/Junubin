// AnaJunubin — Event Detail Screen
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import Button from '../components/Button';

export default function EventDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const event = route.params?.event || {};
  const [isAttending, setIsAttending] = useState(false);

  const handleRSVP = () => {
    setIsAttending(!isAttending);
    Alert.alert(
      isAttending ? 'Cancelled' : 'You\'re In!',
      isAttending ? 'You\'ve cancelled your RSVP.' : `You're attending "${event.title}". See you there!`
    );
  };

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

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.accent} />
            <View>
              <Text style={styles.infoLabel}>{event.date}</Text>
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
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{event.description}</Text>

        <Button
          title={isAttending ? 'Cancel RSVP' : 'RSVP - I\'m Going!'}
          variant={isAttending ? 'outline' : 'primary'}
          size="lg"
          fullWidth
          onPress={handleRSVP}
        />
      </ScrollView>
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
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    letterSpacing: 0.3,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { ...Typography.h2, color: colors.black, marginTop: 8, marginBottom: 16 },
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
