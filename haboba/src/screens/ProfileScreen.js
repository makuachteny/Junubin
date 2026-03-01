import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import HabobaLogo from '../components/HabobaLogo';
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

  const showRoyalCTA = !hasTier('royal');

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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.black} />
        </TouchableOpacity>
        <HabobaLogo size="small" />
        <View style={{ width: 28 }} />
      </View>

      <ScrollView bounces={false} overScrollMode="never" contentContainerStyle={styles.content}>
        {/* Profile photo with border ring */}
        <View style={styles.photoSection}>
          <View style={styles.photoBorderContainer}>
            <Image source={imageSource(displayUser.images?.[0]) || imageSource(currentUser.images[0])} style={styles.profilePhoto} />
          </View>

          {/* Edit button */}
          <TouchableOpacity style={[styles.editBtn, styles.editBtnLeft]} onPress={handleEdit}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Settings button */}
          <TouchableOpacity
            style={[styles.editBtn, styles.editBtnRight]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Name */}
        <Text style={styles.name}>{displayUser.name || currentUser.name}, {displayUser.age || currentUser.age}</Text>

        {/* Verification row */}
        <TouchableOpacity style={styles.verifyBtn} onPress={handleVerify}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
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
                <MaterialCommunityIcons name={item.icon} size={24} color={item.iconColor} />
              ) : (
                <Ionicons name={item.icon} size={24} color={item.iconColor} />
              )}
              <Text style={styles.statText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sticker button */}
        <TouchableOpacity style={styles.stickerBtn} onPress={handleSticker}>
          <View style={styles.stickerCircle}>
            <Ionicons name="add" size={36} color={colors.accent} />
          </View>
          <Text style={styles.stickerText}>Sticker</Text>
        </TouchableOpacity>

        {/* Match More CTA section — only show if not royal+ */}
        {showRoyalCTA && (
          <View style={styles.matchMore}>
            <Text style={styles.matchMoreTitle}>Match More</Text>
            <Text style={styles.matchMoreDesc}>
              Increase your chances to match with See Who Likes You and access to all Royal Features.
            </Text>
            <View style={styles.matchMoreBtn}>
              <Button
                title="GO ROYAL"
                variant="primary"
                size="lg"
                onPress={() => navigation.navigate('Elite')}
                textStyle={{ letterSpacing: 1.2 }}
                fullWidth={false}
                style={{ paddingHorizontal: 56 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
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
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  content: {
    alignItems: 'center',
    paddingBottom: 0,
    backgroundColor: colors.white,
  },
  photoSection: {
    marginTop: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBorderContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: colors.accent,
    padding: 0,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePhoto: {
    width: 174,
    height: 174,
    borderRadius: 87,
    backgroundColor: colors.gray300,
  },
  editBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  editBtnLeft: {
    bottom: 0,
    left: -10,
  },
  editBtnRight: {
    bottom: 0,
    right: -10,
  },
  name: {
    ...Typography.h1,
    color: colors.black,
    marginTop: 20,
    letterSpacing: 0.5,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  verifyText: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statText: {
    ...Typography.captionBold,
    color: colors.black,
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  stickerBtn: {
    alignItems: 'center',
    marginTop: 32,
    gap: 10,
  },
  stickerCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.05)',
  },
  stickerText: {
    ...Typography.bodySemibold,
    fontSize: 14,
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  matchMore: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
    marginTop: 32,
    backgroundColor: '#1A1612',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  matchMoreTitle: {
    ...Typography.h2,
    fontSize: 24,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  matchMoreDesc: {
    ...Typography.bodySmall,
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  matchMoreBtn: {
    marginTop: 24,
  },
});
