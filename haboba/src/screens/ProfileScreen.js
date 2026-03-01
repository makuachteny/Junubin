import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import BrandLogo from '../components/BrandLogo';
import Button from '../components/Button';
import { currentUser, imageSource } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { spotlights, superLikes, whispers, hasTier } = useSubscription();
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!accessToken) return;
    profileService.getMyProfile(accessToken).then((apiUser) => {
      setProfile(profileService.normalizeProfile(apiUser));
    }).catch(() => {});
  }, [accessToken]);

  // Use API profile data if available, otherwise fall back to mock
  const displayUser = profile || currentUser;

  const statItems = [
    { icon: 'flash', iconColor: colors.accent, label: `${spotlights} Spotlights`, screen: 'Boost' },
    { icon: 'crown', iconColor: colors.accent, label: `${superLikes} Super Likes`, screen: 'Elite' },
    { icon: 'send', iconColor: colors.accent, label: `${whispers} Whispers`, screen: null },
  ];

  const showJunubCTA = !hasTier('junub');

  const handleEdit = () => {
    navigation.navigate('EditProfile');
  };

  const handleVerify = () => {
    Alert.alert(
      'Get Verified',
      'Verification helps build trust with your matches. Take a selfie to verify your identity.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify Now',
          onPress: () => Alert.alert('Verification', 'Selfie verification will be available in the next update!'),
        },
      ]
    );
  };

  const handleSticker = () => {
    navigation.navigate('EditProfile');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: showJunubCTA ? 0 : insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.black} />
        </TouchableOpacity>
        <BrandLogo size="small" />
        <View style={{ width: 28 }} />
      </View>

      {/* Upper content — flex fills available space */}
      <View style={styles.content}>
        {/* Profile photo with border ring */}
        <View style={styles.photoSection}>
          <View style={styles.photoBorderContainer}>
            <Image source={imageSource(displayUser.images?.[0]) || imageSource(currentUser.images?.[0])} style={styles.profilePhoto} />
          </View>

          {/* Edit button */}
          <TouchableOpacity style={[styles.editBtn, styles.editBtnLeft]} onPress={handleEdit}>
            <Ionicons name="pencil" size={16} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Settings button */}
          <TouchableOpacity
            style={[styles.editBtn, styles.editBtnRight]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Name */}
        <Text style={styles.name}>{displayUser.name || currentUser.name}, {displayUser.age || currentUser.age}</Text>

        {/* Verification row */}
        <TouchableOpacity style={styles.verifyBtn} onPress={handleVerify}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.verifyText}>Get verified</Text>
        </TouchableOpacity>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {statItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCard}
              onPress={() => item.screen && navigation.navigate(item.screen)}
            >
              {item.icon === 'crown' ? (
                <MaterialCommunityIcons name={item.icon} size={20} color={item.iconColor} />
              ) : (
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
              )}
              <Text style={styles.statText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sticker button */}
        <TouchableOpacity style={styles.stickerBtn} onPress={handleSticker}>
          <View style={styles.stickerCircle}>
            <Ionicons name="add" size={28} color={colors.accent} />
          </View>
          <Text style={styles.stickerText}>Sticker</Text>
        </TouchableOpacity>
      </View>

      {/* Match More CTA section — anchored at bottom */}
      {showJunubCTA && (
        <View style={[styles.matchMore, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.matchMoreTitle}>Match More</Text>
          <Text style={styles.matchMoreDesc}>
            See Who Likes You, connect the diaspora, and unlock advanced filters with Junub.
          </Text>
          <View style={styles.matchMoreBtn}>
            <Button
              title="GO JUNUB"
              variant="primary"
              size="md"
              onPress={() => navigation.navigate('Elite')}
              textStyle={{ letterSpacing: 1.2, fontSize: 14 }}
              fullWidth={false}
              style={{ paddingHorizontal: 44, paddingVertical: 12 }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  photoSection: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBorderContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhoto: {
    width: 134,
    height: 134,
    borderRadius: 67,
    backgroundColor: colors.gray300,
  },
  editBtn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  editBtnLeft: {
    bottom: -2,
    left: -6,
  },
  editBtnRight: {
    bottom: -2,
    right: -6,
  },
  name: {
    ...Typography.h2,
    color: colors.black,
    marginTop: 12,
    letterSpacing: 0.3,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  verifyText: {
    ...Typography.bodySmallMedium,
    fontSize: 13,
    color: colors.black,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statText: {
    ...Typography.captionBold,
    fontSize: 11,
    color: colors.black,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  stickerBtn: {
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  stickerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.04)',
  },
  stickerText: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  matchMore: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    backgroundColor: '#1A1612',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  matchMoreTitle: {
    ...Typography.h3,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  matchMoreDesc: {
    ...Typography.bodySmall,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  matchMoreBtn: {
    marginTop: 16,
  },
});
