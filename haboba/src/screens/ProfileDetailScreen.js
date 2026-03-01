// AnaJunubin — Profile Detail Screen
// BLK-style layout with icon+text detail rows

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { imageSource } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as discoverService from '../api/services/discoverService';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.25;
const MIN_PROFILE_PHOTOS = 3;

// Separate component for photo item to safely use hooks
const PhotoItem = ({ uri, name, width }) => {
  const [hasError, setHasError] = useState(false);
  const { colors } = useTheme();

  if (hasError || !uri) {
    return (
      <View style={[{ width, height: PHOTO_HEIGHT, overflow: 'hidden' }]}>
        <View style={{ width: '100%', height: '100%', backgroundColor: colors.gray300, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 80, fontWeight: '900', fontFamily: FontFamily.black, color: colors.accent, opacity: 0.4 }}>
            {name ? name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
      </View>
    );
  }

  const imgSource = imageSource(uri);

  return (
    <View style={[{ width, height: PHOTO_HEIGHT, overflow: 'hidden' }]}>
      <Image
        source={imgSource}
        style={{ width: '100%', height: '100%', backgroundColor: colors.gray200 }}
        resizeMode="cover"
        onError={() => setHasError(true)}
      />
    </View>
  );
};

// BLK-style detail row item
const DetailItem = ({ iconName, iconSet = 'ionicons', value, styles }) => {
  const { colors } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIconCircle}>
        {iconSet === 'material' ? (
          <MaterialCommunityIcons name={iconName} size={18} color={colors.gray500} />
        ) : (
          <Ionicons name={iconName} size={18} color={colors.gray500} />
        )}
      </View>
      <Text style={styles.detailItemText}>{value}</Text>
    </View>
  );
};

const ProfileDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const profile = route.params?.profile || {};
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const { consumeSuperLike, superLikes } = useSubscription();
  const { accessToken } = useAuth();

  const handlePass = () => {
    if (accessToken && profile.id) {
      discoverService.recordSwipe(accessToken, profile.id, 'pass').catch(() => {});
    }
    navigation.goBack();
  };

  const handleLike = () => {
    if (accessToken && profile.id) {
      discoverService.recordSwipe(accessToken, profile.id, 'like').then((result) => {
        if (result?.match) {
          Alert.alert('It\'s a Match!', `You and ${profile.name} liked each other!`);
        } else {
          Alert.alert('Liked!', `You liked ${profile.name || 'this person'}.`);
        }
      }).catch(() => {
        Alert.alert('Liked!', `You liked ${profile.name || 'this person'}.`);
      });
    } else {
      Alert.alert('Liked!', `You liked ${profile.name || 'this person'}.`);
    }
    navigation.goBack();
  };

  const handleSuperLike = () => {
    if (superLikes <= 0) {
      Alert.alert('No Super Likes', 'You\'re out of Super Likes!', [
        { text: 'Get More', onPress: () => { navigation.goBack(); navigation.navigate('Boost'); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    consumeSuperLike();
    if (accessToken && profile.id) {
      discoverService.recordSwipe(accessToken, profile.id, 'super_like').then((result) => {
        if (result?.match) {
          Alert.alert('It\'s a Match!', `You and ${profile.name} liked each other!`);
        } else {
          Alert.alert('Super Liked!', `You super liked ${profile.name || 'this person'}!`);
        }
      }).catch(() => {});
    }
    navigation.goBack();
  };

  const {
    name = 'User',
    age = 0,
    distance = 0,
    verified = false,
    bio = '',
    about = '',
    job = '',
    school = '',
    images = [],
    interests = [],
    stickers = [],
    height = '',
    lookingFor = '',
    ethnicity = '',
    intention = '',
    pronouns = '',
    education = '',
    children = '',
    promptQuestion = '',
    promptAnswer = '',
  } = profile;

  const profilePromptQuestion = promptQuestion || 'The perfect date would be';
  const profilePromptAnswer = promptAnswer || bio || about || 'Going on a late drive and getting food while we talk.';

  const galleryImages = (() => {
    const source = (images || []).filter(Boolean);
    if (source.length === 0) return [];
    if (source.length >= MIN_PROFILE_PHOTOS) return source;
    const filled = [...source];
    let i = 0;
    while (filled.length < MIN_PROFILE_PHOTOS) {
      filled.push(source[i % source.length]);
      i += 1;
    }
    return filled;
  })();

  const handleScroll = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPhotoIndex(idx);
  }, []);

  // Build detail items matching BLK reference icons
  const detailItems = [
    { iconName: 'gift-outline', value: age ? `${age}` : null },
    { iconName: 'person-outline', value: pronouns || null },
    { iconName: 'resize-outline', value: height || null },
    { iconName: 'location-outline', value: distance ? `${distance} miles away` : null },
    { iconName: 'briefcase-outline', value: job || null },
    { iconName: 'school-outline', value: school || education || null },
    { iconName: 'business-outline', value: null }, // politics placeholder
    { iconName: 'search-outline', value: intention || lookingFor || null },
    { iconName: 'people-outline', value: null }, // relationship type placeholder
    { iconName: 'flag-outline', value: ethnicity || null },
    { iconName: 'happy-outline', value: children || null },
  ].filter((item) => item.value);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* ── Photo Gallery ── */}
        <View style={styles.galleryWrap}>
          <FlatList
            data={galleryImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            keyExtractor={(_, i) => `photo-${i}`}
            renderItem={({ item }) => (
              <PhotoItem uri={item} name={name} width={SCREEN_WIDTH} />
            )}
          />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + 10 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>

          {/* Photo counter */}
          {galleryImages.length > 1 && (
            <View style={[styles.photoCounter, { top: insets.top + 14 }]}>
              <Text style={styles.photoCounterText}>
                {currentPhotoIndex + 1}/{galleryImages.length}
              </Text>
            </View>
          )}

          {/* Dots */}
          {galleryImages.length > 1 && (
            <View style={styles.dotsRow}>
              {galleryImages.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentPhotoIndex ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Profile Info ── */}
        <View style={styles.infoSection}>
          {/* Name row */}
          <View style={styles.nameRow}>
            <View style={styles.nameGroup}>
              <Text style={styles.nameText}>{name}, {age}</Text>
              {verified && (
                <Ionicons name="checkmark-circle" size={22} color={colors.accentDark} style={{ marginLeft: 6 }} />
              )}
            </View>
            <View style={styles.distancePill}>
              <Ionicons name="location-sharp" size={14} color={colors.accentDark} />
              <Text style={styles.distanceText}>{distance} mi</Text>
            </View>
          </View>

          {/* ── BLK-style detail grid ── */}
          {detailItems.length > 0 && (
            <View style={styles.detailGrid}>
              {detailItems.map((item, index) => (
                <DetailItem
                  key={index}
                  iconName={item.iconName}
                  iconSet={item.iconSet}
                  value={item.value}
                  styles={styles}
                />
              ))}
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* About */}
          {(about || bio) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.sectionBody}>{about || bio}</Text>
            </View>
          ) : null}

          {/* Prompt card */}
          <View style={styles.promptCard}>
            <View style={styles.promptTitleRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.gray400} />
              <Text style={styles.promptQuestion}>{profilePromptQuestion}</Text>
            </View>
            <Text style={styles.promptAnswer}>{profilePromptAnswer}</Text>
          </View>

          {/* Looking For / Intention */}
          {(lookingFor || intention) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Looking For</Text>
              <View style={styles.chipWrap}>
                <View style={styles.lookingForPill}>
                  <Ionicons name="heart" size={14} color="#FFF" />
                  <Text style={styles.lookingForText}>{intention || lookingFor}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Interests */}
          {interests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.chipWrap}>
                {interests.map((item, i) => (
                  <View key={i} style={styles.interestChip}>
                    <Text style={styles.interestText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Cultural Identity */}
          {stickers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Identity</Text>
              <View style={styles.chipWrap}>
                {stickers.map((s, i) => (
                  <View key={i} style={styles.stickerPill}>
                    <Text style={styles.stickerEmoji}>{s.emoji}</Text>
                    <Text style={styles.stickerLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bottom spacing for action bar */}
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <View style={[styles.actionBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.passBtn}
          onPress={handlePass}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={28} color="#C95D4F" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.likeBtn}
          onPress={handleLike}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={22} color="#FFF" />
          <Text style={styles.likeBtnText}>Like</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.superBtn}
          onPress={handleSuperLike}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={22} color={colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollView: {
    flex: 1,
  },

  /* ── Gallery ── */
  galleryWrap: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    backgroundColor: colors.gray200,
  },
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(26,22,18,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoCounter: {
    position: 'absolute',
    right: 14,
    backgroundColor: 'rgba(26, 22, 18, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    zIndex: 10,
  },
  photoCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.accentDark,
    shadowColor: colors.accentDark,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },

  /* ── Info Section ── */
  infoSection: {
    paddingHorizontal: 22,
    paddingTop: 22,
    backgroundColor: colors.white,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: 0.2,
  },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isDark ? colors.gray100 : colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: colors.gray200,
  },
  distanceText: {
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  /* ── BLK-style detail grid ── */
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gray100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  detailIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailItemText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },

  divider: {
    height: 1,
    backgroundColor: colors.separator,
    marginVertical: 18,
  },

  /* ── Sections ── */
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.gray500,
  },
  promptCard: {
    backgroundColor: colors.gray100,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
  },
  promptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  promptQuestion: {
    color: colors.gray500,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  promptAnswer: {
    color: colors.black,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lookingForPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentDark,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    shadowColor: colors.accentDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  lookingForText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  interestChip: {
    backgroundColor: colors.gray200,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  interestText: {
    color: colors.royal,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  stickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: isDark ? colors.gray100 : colors.cream,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.roseTint35,
  },
  stickerEmoji: {
    fontSize: 16,
  },
  stickerLabel: {
    color: colors.black,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  /* ── Action Bar ── */
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(26, 22, 18, 0.95)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 0.5,
    borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  passBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(201, 93, 79, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(201, 93, 79, 0.2)',
  },
  likeBtn: {
    flex: 1,
    height: 54,
    backgroundColor: colors.accentDark,
    borderRadius: 27,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.accentDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  likeBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  superBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.roseTint12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.roseTint20,
  },
});

export default ProfileDetailScreen;
