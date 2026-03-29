import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GraffitiFlame } from '../components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import BrandLogo from '../components/BrandLogo';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';

const TIER_LABELS = { free: 'Free', plus: 'JuNubin+', junub: 'Junub' };

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PressableRow({ style, onPress, children }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 68,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 68,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };
  return (
    <AnimatedTouchable
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.7}
    >
      {children}
    </AnimatedTouchable>
  );
}

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { logout, session, setDevBypass } = useAuth();
  const { currentUser } = useCurrentUser();
  const mode = currentUser.preferences?.mode || 'Dating';
  const [showMe, setShowMe] = useState(currentUser.preferences?.showMe ?? true);

  const handleShowMeToggle = (val) => {
    setShowMe(val);
    if (session) {
      profileService.updateProfile({ showMe: val }).catch(() => {});
    }
  };
  const { tier, effectiveTier, promoTier, promoEndsAt, hasTier, restorePurchases, isSubscribed, reset, spotlights, superLikes, adsEnabled, setAdsEnabled } = useSubscription();
  const lookingFor = currentUser.preferences?.lookingFor || 'Women';
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [modal, setModal] = useState({ visible: false, type: 'loading', title: '', message: '' });
  const contentAnim = useRef(new Animated.Value(0)).current;
  const promoActive = promoTier && promoEndsAt && new Date(promoEndsAt).getTime() > Date.now();
  const tierLabel = TIER_LABELS[effectiveTier] || TIER_LABELS[tier];

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
      setModal({ visible: true, type: 'success', title: 'Restored!', message: `Your current tier: ${tierLabel}` });
    } else {
      setModal({ visible: true, type: 'error', title: 'Restore Failed', message: result.error || 'Please try again.' });
    }
  };

  const handleManageSubscription = async () => {
    if (!isSubscribed()) {
      navigation.navigate('Elite');
      return;
    }
    if (promoActive && tier === 'free') {
      Alert.alert('Promo Plan', 'Your membership is a time-limited promo. Manage paid subscriptions in the app store.');
      return;
    }
    const iosUrl = 'https://apps.apple.com/account/subscriptions';
    const androidUrl = 'https://play.google.com/store/account/subscriptions?package=com.haboba.app';
    const target = Platform.OS === 'ios' ? iosUrl : androidUrl;
    try {
      const supported = await Linking.canOpenURL(target);
      if (!supported) throw new Error('unsupported');
      await Linking.openURL(target);
    } catch {
      Alert.alert('Manage Subscription', 'Unable to open subscription management. Please visit your app store account subscriptions.');
    }
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
            await setDevBypass(false);
            await reset();
          },
        },
      ]
    );
  };

  const handleInfoPagePress = useCallback((pageKey) => {
    navigation.navigate('SettingsInfo', { pageKey });
  }, [navigation]);

  const handleManageAccount = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const menuItems = useMemo(() => [
    { label: 'Invite Friends', icon: 'gift-outline', onPress: () => navigation.navigate('Referral') },
    { label: 'Find Friends', icon: 'people-circle-outline', onPress: () => navigation.navigate('FindFriends') },
    { label: 'Verify Your Photo', icon: 'camera-outline', onPress: () => navigation.navigate('PhotoVerification') },
    { label: 'FAQ', icon: 'help-circle-outline', onPress: () => handleInfoPagePress('faq') },
    { label: 'Contact Us', icon: 'mail-outline', onPress: () => handleInfoPagePress('contact') },
    { label: 'Terms of Use', icon: 'document-text-outline', onPress: () => handleInfoPagePress('terms') },
    { label: 'Privacy Policy', icon: 'shield-outline', onPress: () => handleInfoPagePress('privacy') },
    { label: 'Community Guidelines', icon: 'people-outline', onPress: () => handleInfoPagePress('guidelines') },
    { label: 'Safety Tips', icon: 'warning-outline', onPress: () => handleInfoPagePress('safety') },
    { label: 'Manage Subscription', icon: 'card-outline', onPress: handleManageSubscription },
    { label: 'Restore Purchases', icon: 'refresh-outline', onPress: handleRestore },
    { label: 'Manage Account', icon: 'person-outline', onPress: handleManageAccount },
  ], [handleInfoPagePress, handleManageAccount, handleManageSubscription, handleRestore, navigation]);
  const surveySnapshot = useMemo(() => [
    { label: 'Mode', value: mode },
    { label: 'Looking For', value: lookingFor },
    { label: 'Distance', value: `${currentUser.preferences?.distance || 50} mi` },
    { label: 'Age Range', value: `${currentUser.preferences?.ageRange?.[0] || 21}-${currentUser.preferences?.ageRange?.[1] || 30}` },
    { label: 'Show Me on AnaJubin', value: showMe ? 'On' : 'Off' },
  ], [mode, lookingFor, showMe]);
  const appChanges = useMemo(() => [
    { label: 'Theme', value: isDark ? 'Dark' : 'Light' },
    { label: 'Ads', value: adsEnabled ? 'On' : 'Off' },
    { label: 'Membership', value: tierLabel },
    { label: 'Spotlights', value: `${spotlights}` },
    { label: 'Super Likes', value: `${superLikes}` },
  ], [isDark, adsEnabled, tierLabel, spotlights, superLikes]);

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
            <MaterialCommunityIcons name="crown" size={18} color={colors.green} />
            <Text style={styles.tierBadgeText}>
              {tierLabel} Member{promoActive && tier === 'free' ? ' (Promo)' : ''}
            </Text>
          </View>
        )}

        {/* Upgrade buttons — hide based on current tier */}
        <View style={styles.upgradeSection}>
          {!hasTier('junub') && (
            <>
              <Button
                title="GO JUNUB"
                subtitle="See Who Likes You, Diaspora Connect, and more!"
                variant="primary"
                size="lg"
                onPress={() => navigation.navigate('Elite')}
                textStyle={{ letterSpacing: 1 }}
              />
              <View style={{ height: 12 }} />
            </>
          )}

          {!hasTier('plus') && (
            <Button
              title="GET HABOBA+"
              subtitle="Unlimited Likes and Rewinds"
              variant="outline"
              size="md"
              textStyle={{ letterSpacing: 1 }}
              onPress={() => navigation.navigate('Elite')}
            />
          )}
        </View>

        <View style={styles.boostRow}>
          <TouchableOpacity style={styles.boostCard} onPress={() => navigation.navigate('Boost')}>
            <GraffitiFlame size={24} color={colors.green} filled />
            <Text style={styles.boostCardText}>GET MORE{'\n'}SPOTLIGHTS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.superLikeCard} onPress={() => navigation.navigate('Elite')}>
            <MaterialCommunityIcons name="crown" size={24} color={colors.green} />
            <Text style={styles.boostCardText}>GET MORE{'\n'}SUPER LIKES</Text>
          </TouchableOpacity>
        </View>

        {/* Others */}
        <View style={styles.othersSection}>
          <Text style={styles.othersTitle}>Others</Text>

          <PressableRow style={styles.menuRow} onPress={() => handleInfoPagePress('contact')}>
            <Text style={styles.menuLabel}>Email</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>

          <PressableRow style={styles.menuRow} onPress={() => navigation.navigate('Notifications')}>
            <Text style={styles.menuLabel}>Push Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>

          <PressableRow style={styles.menuRow} onPress={() => navigation.navigate('GameSettings')}>
            <Text style={styles.menuLabel}>Game Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>

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
              trackColor={{ false: colors.gray300, true: colors.green }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.menuLabel}>Ads</Text>
            <Switch
              value={adsEnabled}
              onValueChange={setAdsEnabled}
              trackColor={{ false: colors.gray300, true: colors.green }}
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
              trackColor={{ false: colors.gray300, true: colors.green }}
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
          <PressableRow key={idx} style={styles.menuRow} onPress={item.onPress}>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>
        ))}

        {/* Logout */}
        <PressableRow style={styles.menuRow} onPress={handleLogout}>
          <Text style={[styles.menuLabel, { color: colors.error }]}>Logout</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
        </PressableRow>

        {/* Footer */}
        <View style={styles.footer}>
          <BrandLogo size="small" />
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
    height: 56,
    borderBottomWidth: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: colors.black,
    letterSpacing: -0.8,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  doneText: {
    ...Typography.bodySemibold,
    color: colors.green,
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
    backgroundColor: colors.greenTint08,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    ...getShadow('sm', isDark),
  },
  tierBadgeText: {
    ...Typography.label,
    color: colors.green,
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
    borderWidth: 1,
    borderColor: colors.greenTint25,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.greenTint06,
    ...getShadow('sm', isDark),
  },
  superLikeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.greenTint25,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.greenTint06,
    ...getShadow('sm', isDark),
  },
  boostCardText: {
    ...Typography.captionBold,
    color: colors.green,
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
    color: colors.green,
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
    backgroundColor: colors.green,
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
    backgroundColor: colors.green,
    shadowColor: colors.green,
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
    borderColor: colors.green,
    backgroundColor: colors.greenTint10,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
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
    color: colors.green,
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
    color: colors.green,
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
