import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import HabobaLogo from '../components/HabobaLogo';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';
import { currentUser } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';

const TIER_LABELS = { free: 'Free', gold: 'Gold', royal: 'Royal', crown: 'Crown' };

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, accessToken } = useAuth();
  const mode = currentUser.preferences.mode;
  const [showMe, setShowMe] = useState(currentUser.preferences.showMe);

  const handleShowMeToggle = (val) => {
    setShowMe(val);
    if (accessToken) {
      profileService.updateProfile(accessToken, { showMe: val }).catch(() => {});
    }
  };
  const [ads, setAds] = useState(true);
  const lookingFor = currentUser.preferences.lookingFor;
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { tier, hasTier, restorePurchases, cancelSubscription, isSubscribed, purchaseInProgress, reset } = useSubscription();
  const [modal, setModal] = useState({ visible: false, type: 'loading', title: '', message: '' });
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 340,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  const handleRestore = async () => {
    setModal({ visible: true, type: 'loading', title: 'Restoring...', message: 'Checking previous purchases' });
    const result = await restorePurchases();
    if (result.success) {
      setModal({ visible: true, type: 'success', title: 'Restored!', message: `Your current tier: ${TIER_LABELS[tier]}` });
    } else {
      setModal({ visible: true, type: 'error', title: 'Restore Failed', message: result.error || 'Please try again.' });
    }
  };

  const handleManageSubscription = () => {
    if (!isSubscribed()) {
      navigation.navigate('Elite');
      return;
    }
    Alert.alert(
      `${TIER_LABELS[tier]} Subscription`,
      `You are currently on the ${TIER_LABELS[tier]} plan.`,
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: () => {
            cancelSubscription();
            Alert.alert('Cancelled', 'Your subscription has been cancelled. You are now on the Free plan.');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            await reset();
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Onboarding' }],
              })
            );
          },
        },
      ]
    );
  };

  const handleInfoPagePress = (pageKey) => {
    navigation.navigate('SettingsInfo', { pageKey });
  };

  const handleManageAccount = () => {
    navigation.navigate('EditProfile');
  };

  const menuItems = [
    { label: 'FAQ', icon: 'help-circle-outline', onPress: () => handleInfoPagePress('faq') },
    { label: 'Contact Us', icon: 'mail-outline', onPress: () => handleInfoPagePress('contact') },
    { label: 'Terms of Use', icon: 'document-text-outline', onPress: () => handleInfoPagePress('terms') },
    { label: 'Privacy Policy', icon: 'shield-outline', onPress: () => handleInfoPagePress('privacy') },
    { label: 'Community Guidelines', icon: 'people-outline', onPress: () => handleInfoPagePress('guidelines') },
    { label: 'Safety Tips', icon: 'warning-outline', onPress: () => handleInfoPagePress('safety') },
    { label: 'Manage Subscription', icon: 'card-outline', onPress: handleManageSubscription },
    { label: 'Restore Purchases', icon: 'refresh-outline', onPress: handleRestore },
    { label: 'Manage Account', icon: 'person-outline', onPress: handleManageAccount },
  ];
  const surveySnapshot = [
    { label: 'Mode', value: mode },
    { label: 'Looking For', value: lookingFor },
    { label: 'Distance', value: `${currentUser.preferences.distance} mi` },
    { label: 'Age Range', value: `${currentUser.preferences.ageRange[0]}-${currentUser.preferences.ageRange[1]}` },
    { label: 'Show Me on AnaJubin', value: showMe ? 'On' : 'Off' },
  ];
  const appChanges = [
    { label: 'Theme', value: isDark ? 'Dark' : 'Light' },
    { label: 'Ads', value: ads ? 'On' : 'Off' },
    { label: 'Membership', value: TIER_LABELS[tier] },
    { label: 'Spotlights', value: `${currentUser.boosts}` },
    { label: 'Super Likes', value: `${currentUser.superLikes}` },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.content}
        style={{
          opacity: contentAnim,
          transform: [
            {
              translateY: contentAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16, 0],
              }),
            },
          ],
        }}
      >
        {/* Subscription badge */}
        {isSubscribed() && (
          <View style={styles.tierBadge}>
            <MaterialCommunityIcons name="crown" size={18} color={colors.accent} />
            <Text style={styles.tierBadgeText}>{TIER_LABELS[tier]} Member</Text>
          </View>
        )}

        {/* Upgrade buttons — hide based on current tier */}
        <View style={styles.upgradeSection}>
          {!hasTier('crown') && (
            <Button
              title="UNLOCK CROWN"
              subtitle="Free Whispers, Advanced Filters and more!"
              variant="dark"
              size="lg"
              onPress={() => navigation.navigate('Elite')}
              textStyle={{ letterSpacing: 1 }}
            />
          )}

          {!hasTier('crown') && <View style={{ height: 12 }} />}

          {!hasTier('royal') && (
            <>
              <Button
                title="GO ROYAL"
                subtitle="See Who Likes You and More!"
                variant="primary"
                size="lg"
                onPress={() => navigation.navigate('Elite')}
                textStyle={{ letterSpacing: 1 }}
              />
              <View style={{ height: 12 }} />
            </>
          )}

          {!hasTier('gold') && (
            <Button
              title="GO GOLD"
              variant="outline"
              size="md"
              textStyle={{ letterSpacing: 1 }}
              onPress={() => navigation.navigate('Elite')}
            />
          )}
        </View>

        <View style={styles.boostRow}>
          <TouchableOpacity style={styles.boostCard} onPress={() => navigation.navigate('Boost')}>
            <Ionicons name="flash" size={24} color={colors.accent} />
            <Text style={styles.boostCardText}>GET MORE{'\n'}SPOTLIGHTS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.superLikeCard} onPress={() => navigation.navigate('Elite')}>
            <MaterialCommunityIcons name="crown" size={24} color={colors.accent} />
            <Text style={styles.boostCardText}>GET MORE{'\n'}SUPER LIKES</Text>
          </TouchableOpacity>
        </View>

        {/* Others */}
        <View style={styles.othersSection}>
          <Text style={styles.othersTitle}>Others</Text>

          <TouchableOpacity style={styles.menuRow} onPress={() => handleInfoPagePress('email')}>
            <Text style={styles.menuLabel}>Email</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.menuLabel}>Push Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Show me on AnaJubin</Text>
              <Text style={styles.switchDesc}>
                While turned off, you will not be shown in the card stack.
              </Text>
            </View>
            <Switch
              value={showMe}
              onValueChange={handleShowMeToggle}
              trackColor={{ false: colors.gray300, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.menuLabel}>Ads</Text>
            <Switch
              value={ads}
              onValueChange={setAds}
              trackColor={{ false: colors.gray300, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Dark Mode</Text>
              <Text style={styles.switchDesc}>
                Switch between light and dark appearance.
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.gray300, true: colors.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>Survey Snapshot</Text>
          {surveySnapshot.map((item) => (
            <View key={item.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.cardTitle}>App Changes</Text>
          {appChanges.map((item) => (
            <View key={item.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Menu items */}
        {menuItems.map((item, idx) => (
          <TouchableOpacity key={idx} style={styles.menuRow} onPress={item.onPress}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
          <Text style={[styles.menuLabel, { color: colors.error }]}>Logout</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <HabobaLogo size="small" />
          <Text style={styles.footerVersion}>Version 1.0.0 (build: 1)</Text>
        </View>
      </Animated.ScrollView>

      <PurchaseModal
        visible={modal.visible}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onDismiss={() => setModal((m) => ({ ...m, visible: false }))}
      />
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: colors.black,
    flex: 1,
    textAlign: 'center',
  },
  doneText: {
    ...Typography.bodySemibold,
    color: colors.accent,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    ...getShadow('sm', isDark),
  },
  tierBadgeText: {
    ...Typography.label,
    color: colors.accent,
  },
  upgradeSection: {
    marginTop: 16,
  },
  boostRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  boostCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    ...getShadow('md', isDark),
  },
  superLikeCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.cardBg,
    ...getShadow('md', isDark),
  },
  boostCardText: {
    ...Typography.captionBold,
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  modeSection: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 20,
  },
  modeDesc: {
    ...Typography.bodySmall,
    color: colors.black,
    textAlign: 'center',
    marginTop: 12,
    opacity: 0.7,
  },
  separator: {
    height: 1,
    backgroundColor: colors.separator,
    marginTop: 20,
    width: '100%',
  },
  section: {
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  sectionValue: {
    ...Typography.bodySemibold,
    color: colors.accent,
  },
  sliderPlaceholder: {
    marginTop: 16,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: colors.gray300,
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
    width: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    right: 0,
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sliderLabel: {
    ...Typography.caption,
    color: colors.black,
    opacity: 0.6,
    fontFamily: FontFamily.regular,
  },
  helperText: {
    ...Typography.label,
    color: colors.black,
    opacity: 0.6,
    marginTop: 12,
    lineHeight: 18,
    fontWeight: '400',
    fontFamily: FontFamily.regular,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.gray400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  radioLabel: {
    ...Typography.body,
    color: colors.black,
    opacity: 0.85,
  },
  othersSection: {
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingTop: 16,
    marginTop: 10,
  },
  othersTitle: {
    ...Typography.sectionLabel,
    color: colors.accent,
    marginBottom: 12,
  },
  sectionCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...getShadow('sm', isDark),
  },
  cardTitle: {
    ...Typography.sectionLabel,
    color: colors.accent,
    marginVertical: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    paddingVertical: 10,
    gap: 12,
  },
  infoLabel: {
    ...Typography.bodySmall,
    color: colors.black,
    opacity: 0.75,
    fontFamily: FontFamily.medium,
    flex: 1,
  },
  infoValue: {
    ...Typography.bodySemibold,
    color: colors.black,
    textAlign: 'right',
    fontFamily: FontFamily.bold,
    maxWidth: '55%',
  },
  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  menuLabel: {
    ...Typography.body,
    color: colors.black,
    opacity: 0.85,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  switchDesc: {
    ...Typography.caption,
    color: colors.black,
    opacity: 0.6,
    marginTop: 4,
    maxWidth: 260,
    fontFamily: FontFamily.regular,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  footerVersion: {
    ...Typography.caption,
    color: colors.black,
    opacity: 0.5,
    fontFamily: FontFamily.regular,
  },
});
