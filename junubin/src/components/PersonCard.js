// PersonCard — one person in a people list (Home list view, Directory
// results, connection lists).
//
// This is the non-dating replacement for the swipe-deck ProfileCard:
// it leads with the things that matter for finding your people —
// city, distance, background, languages and what someone is open to —
// rather than age and photos. There is no like/pass affordance; the
// only action is Follow, and tapping the row opens the profile.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { normalizeOpenTo, OPEN_TO_BY_KEY } from '../data/openTo';

const KM_PER_MILE = 1.609344;

// Distance is shown coarsely on purpose. Even for a user who opted into
// map visibility we never imply street-level precision.
export function formatDistance(distanceKm) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  const miles = distanceKm / KM_PER_MILE;
  if (miles < 1) return 'Under a mile away';
  if (miles < 10) return `${Math.round(miles)} mi away`;
  if (miles < 100) return `${Math.round(miles / 5) * 5} mi away`;
  return `${Math.round(miles / 50) * 50}+ mi away`;
}

function placeLabel(person) {
  const parts = [person?.city, person?.country || person?.countryCode].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

function lastActiveLabel(lastActiveAt) {
  if (!lastActiveAt) return null;
  const ms = Date.now() - new Date(lastActiveAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = ms / 3.6e6;
  if (hours < 1) return 'Active now';
  if (hours < 24) return 'Active today';
  if (hours < 24 * 7) return 'Active this week';
  return null;
}

export default function PersonCard({
  person,
  onPress,
  onFollow,
  isFollowing = false,
  followBusy = false,
  showFollow = true,
  style,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  if (!person) return null;

  const photo = person.images?.[0] || person.photos?.[0];
  const place = placeLabel(person);
  const distance = formatDistance(person.distanceKm ?? person.distance);
  const activity = lastActiveLabel(person.lastActiveAt);
  // `openTo` is persisted as keys, so map back to display labels here.
  const openTo = normalizeOpenTo(person.openTo)
    .slice(0, 3)
    .map((key) => ({ key, label: OPEN_TO_BY_KEY[key]?.label || key }));
  const languages = Array.isArray(person.languages) ? person.languages.slice(0, 3) : [];
  // Background and profession read as one "who is this" line so the
  // card stays two lines tall regardless of how much a person filled in.
  const detail = [person.ethnicity, person.profession || person.job || person.school]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress?.(person)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Open ${person.name || 'profile'}`}
      testID={`person-card-${person.id}`}
    >
      <Image source={imageSource(photo)} style={styles.avatar} />

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{person.name || 'JuNubin member'}</Text>
          {person.verified ? (
            <Ionicons name="checkmark-circle" size={15} color={colors.accent} style={styles.verified} />
          ) : null}
        </View>

        {(place || distance) ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color={colors.gray500} />
            <Text style={styles.meta} numberOfLines={1}>
              {[place, distance].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}

        {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}

        {(openTo.length > 0 || languages.length > 0) ? (
          <View style={styles.badges}>
            {openTo.map((badge) => (
              <View key={`open-${badge.key}`} style={styles.openBadge}>
                <Text style={styles.openBadgeText} numberOfLines={1}>{badge.label}</Text>
              </View>
            ))}
            {languages.map((lang) => (
              <View key={`lang-${lang}`} style={styles.langBadge}>
                <Text style={styles.langBadgeText} numberOfLines={1}>{lang}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {activity ? <Text style={styles.activity}>{activity}</Text> : null}
      </View>

      {showFollow ? (
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followBtnActive]}
          onPress={() => onFollow?.(person)}
          disabled={followBusy}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isFollowing ? `Unfollow ${person.name}` : `Follow ${person.name}`}
          testID={`person-follow-${person.id}`}
        >
          <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.gray200,
  },
  body: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: colors.black,
    flexShrink: 1,
  },
  verified: {
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  meta: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: colors.gray500,
    marginLeft: 3,
    flexShrink: 1,
  },
  detail: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: colors.gray600,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.accentTint10,
  },
  openBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: colors.accent,
  },
  langBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.gray100,
  },
  langBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: colors.gray700,
  },
  activity: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: colors.success,
    marginTop: 5,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.black,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  followText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: colors.white,
  },
  followTextActive: {
    color: colors.gray700,
  },
});
