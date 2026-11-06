// LocationDisclosure — the in-app explanation that MUST be shown and
// accepted before anything in the app calls the OS location permission
// dialog.
//
// Google Play requires a prominent in-app disclosure plus affirmative
// consent before collecting location; Apple's guidance is that the
// system prompt should never arrive without context. This card is that
// context. It deliberately explains three things people actually care
// about: what we read, what other people see, and how to turn it off.
//
// Accepting here only unlocks "we may now ask the OS". It does NOT make
// the user visible to anyone — that is `Profile.locationVisibility`,
// which stays 'off' until they choose otherwise.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from './Button';

const POINTS = [
  {
    icon: 'navigate-outline',
    title: 'Used to show people near you',
    body: 'We read your device location to centre the map and sort the directory by distance.',
  },
  {
    icon: 'eye-off-outline',
    title: 'You are hidden by default',
    body: 'Nobody sees you on the map until you turn visibility on yourself. Browsing is always private.',
  },
  {
    icon: 'locate-outline',
    title: 'Approximate, never exact',
    body: 'If you do choose to appear, your position is rounded to roughly a kilometre. Your street address is never shared.',
  },
  {
    icon: 'lock-closed-outline',
    title: 'Never sold, never ad-targeted',
    body: 'Your location is not sold, shared with advertisers, or used to target ads. We do not track you in the background.',
  },
];

export default function LocationDisclosure({
  onAccept,
  onDecline,
  declineLabel = 'Not now',
  acceptLabel = 'Continue',
  title = 'Find South Sudanese people near you',
  subtitle = 'Before we ask your phone for location, here is exactly what that means.',
  style,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="map-outline" size={30} color={colors.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.points}>
          {POINTS.map((p) => (
            <View key={p.icon} style={styles.point}>
              <View style={styles.pointIcon}>
                <Ionicons name={p.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.pointText}>
                <Text style={styles.pointTitle}>{p.title}</Text>
                <Text style={styles.pointBody}>{p.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          You can change or switch off location sharing any time in Settings → Privacy.
        </Text>
      </ScrollView>

      {/* Button does not forward testID, so the wrappers carry it. */}
      <View style={styles.actions}>
        <View testID="location-disclosure-accept">
          <Button title={acceptLabel} variant="primary" size="md" fullWidth onPress={onAccept} />
        </View>
        <View testID="location-disclosure-decline">
          <Button title={declineLabel} variant="outline" size="md" fullWidth onPress={onDecline} />
        </View>
      </View>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  scroll: {
    paddingVertical: 24,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentTint10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    ...Typography.h2,
    color: colors.black,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 8,
  },
  points: {
    marginTop: 24,
    gap: 16,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentTint08,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: colors.black,
  },
  pointBody: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray600,
    marginTop: 2,
  },
  footnote: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 22,
  },
  actions: {
    paddingBottom: 8,
    gap: 10,
  },
});
