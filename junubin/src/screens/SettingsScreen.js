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
import { useSubscription, SHOW_PAYMENTS_UI, StripeService } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import * as safetyService from '../api/services/safetyService';
import { supabase } from '../config/supabase';
import {
  promptForPushPermission,
  getNotificationPermissionStatus,
} from '../utils/notifications';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { REFERRALS_BACKEND_READY } from '../utils/referralService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIER_LABELS = { free: 'Free', plus: 'JuNubin+', junub: 'Junub' };
const INCOGNITO_KEY = '@junubin_incognito';
const DISTANCE_UNIT_KEY = '@junubin_distance_unit';

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
  const { logout, session } = useAuth();
  const { currentUser } = useCurrentUser();
  const mode = currentUser.preferences?.mode || 'Dating';
  const [showMe, setShowMe] = useState(currentUser.preferences?.showMe ?? true);

  const handleShowMeToggle = (val) => {
    setShowMe(val);
    if (session) {
      profileService.updateProfile({ showMe: val }).catch(() => {});
    }
  };
  const { tier, effectiveTier, promoTier, promoEndsAt, hasTier, canUseIncognito, restorePurchases, isSubscribed, reset, spotlights, superLikes } = useSubscription();
  const [incognito, setIncognitoState] = useState(false);
  const [distanceUnit, setDistanceUnitState] = useState('mi');
  // Snap-Map opt-in. Source of truth is `Profile.shareLocation` from
  // the 00032 migration; we hydrate from currentUser and write back
  // via profileService.updateProfile (which has shareLocation on its
  // allow-list).
  const [shareLocation, setShareLocationState] = useState(false);

  // Hydrate persisted toggles on mount. Incognito's source of truth is
  // `Profile.incognito` (so it syncs across devices); AsyncStorage is a
  // fast-path cache that avoids a flicker on cold start before the
  // server fetch lands. distanceUnit stays local-only — it's a UI
  // display preference, not an account setting.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(INCOGNITO_KEY),
      AsyncStorage.getItem(DISTANCE_UNIT_KEY),
    ]).then(([inc, unit]) => {
      if (cancelled) return;
      if (inc === 'true') setIncognitoState(true);
      if (unit === 'mi' || unit === 'km') setDistanceUnitState(unit);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Re-hydrate incognito from currentUser whenever the profile changes
  // (e.g., after refreshUser fires from useAppStateRefresh on
  // background→foreground). Server wins; AsyncStorage is updated to
  // match so the next cold start matches the server immediately.
  useEffect(() => {
    const serverFlag = !!currentUser?.profile?.incognito;
    setIncognitoState(serverFlag);
    AsyncStorage.setItem(INCOGNITO_KEY, serverFlag ? 'true' : 'false').catch(() => {});
  }, [currentUser?.profile?.incognito]);

  // shareLocation is server-only (no AsyncStorage cache) — the map
  // surface is only meaningful when authenticated, so the brief flash
  // of `false` before the server fetch lands is acceptable.
  useEffect(() => {
    setShareLocationState(!!currentUser?.profile?.shareLocation);
  }, [currentUser?.profile?.shareLocation]);

  // Persist on change. Write to the DB first so other devices can see
  // it; the local cache is best-effort. If the DB write fails (offline),
  // we revert the toggle so the user isn't lied to about a setting that
  // didn't actually save.
  const setIncognito = useCallback(async (next) => {
    setIncognitoState(next);
    AsyncStorage.setItem(INCOGNITO_KEY, next ? 'true' : 'false').catch(() => {});
    try {
      await profileService.updateProfile({ incognito: next });
    } catch (e) {
      // Revert local state on failure.
      setIncognitoState(!next);
      AsyncStorage.setItem(INCOGNITO_KEY, !next ? 'true' : 'false').catch(() => {});
      Alert.alert('Could not update', e?.message || 'Try again when you have a connection.');
    }
  }, []);
  const setDistanceUnit = useCallback((next) => {
    const value = typeof next === 'function' ? next(distanceUnit) : next;
    setDistanceUnitState(value);
    AsyncStorage.setItem(DISTANCE_UNIT_KEY, value).catch(() => {});
  }, [distanceUnit]);

  // Same revert-on-failure pattern as Incognito. Toggling shareLocation
  // on/off writes to Profile.shareLocation; the map's "who's visible"
  // query reads from that column.
  const setShareLocation = useCallback(async (next) => {
    setShareLocationState(next);
    try {
      await profileService.updateProfile({ shareLocation: next });
    } catch (e) {
      setShareLocationState(!next);
      Alert.alert('Could not update', e?.message || 'Try again when you have a connection.');
    }
  }, []);
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

  const handleViewBlocked = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        Alert.alert('Blocked Users', 'Sign in to manage blocked users.');
        return;
      }
      const { data: appUser } = await supabase
        .from('User')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();
      if (!appUser) {
        Alert.alert('Blocked Users', 'Could not load your account.');
        return;
      }

      const { data: rows, error } = await supabase
        .from('Block')
        .select('blockedId, blocked:User!blockedId(id, displayName)')
        .eq('blockerId', appUser.id);
      if (error) throw error;

      if (!rows || rows.length === 0) {
        Alert.alert('Blocked Users', 'You have no blocked users.', [{ text: 'OK' }]);
        return;
      }

      const buttons = rows.slice(0, 8).map((r) => ({
        text: `Unblock ${r.blocked?.displayName || 'user'}`,
        onPress: async () => {
          try {
            await safetyService.unblockUser(r.blockedId);
            Alert.alert('Unblocked', 'They can now see and contact you again.');
          } catch (e) {
            Alert.alert('Could not unblock', e?.message || 'Try again.');
          }
        },
      }));
      buttons.push({ text: 'Done', style: 'cancel' });
      Alert.alert(
        'Blocked Users',
        rows.length > 8 ? `Showing first 8 of ${rows.length}.` : `${rows.length} blocked.`,
        buttons,
      );
    } catch (e) {
      Alert.alert('Blocked Users', e?.message || 'Could not load blocked list.');
    }
  }, []);

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

    // Stripe subscribers (web + Android purchases) go to the Stripe
    // Billing Portal — they can cancel, switch plan, update card, and
    // download invoices there. IAP subscribers fall through to the
    // store-account URL because Apple/Google own the cancellation
    // surface for purchases that went through them.
    const portal = await StripeService.openBillingPortal({ returnUrl: 'junubin://account' });
    if (portal.available && portal.url) {
      try {
        const supported = await Linking.canOpenURL(portal.url);
        if (!supported) throw new Error('unsupported');
        await Linking.openURL(portal.url);
        return;
      } catch {
        // Fall through to store URL.
      }
    }

    const iosUrl = 'https://apps.apple.com/account/subscriptions';
    const androidUrl = 'https://play.google.com/store/account/subscriptions?package=com.junubin.app';
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
    // Invite Friends hides until REFERRALS_BACKEND_READY flips true —
    // the reward grants are local-only today and would let a user
    // generate free Plus weeks / Super Likes / coins client-side.
    ...(REFERRALS_BACKEND_READY
      ? [{ label: 'Invite Friends', icon: 'gift-outline', onPress: () => navigation.navigate('Referral') }]
      : []),
    { label: 'Find Friends', icon: 'people-circle-outline', onPress: () => navigation.navigate('FindFriends') },
    { label: 'Verify Your Photo', icon: 'camera-outline', onPress: () => navigation.navigate('PhotoVerification') },
    // Accessibility prefs are a one-time onboarding step but the
    // screen is reusable for tuning later — exposing it here gives
    // a user who skipped it (or who developed new needs) a way back
    // in without flipping accountPurpose.
    { label: 'Accessibility Preferences', icon: 'accessibility-outline', onPress: () => navigation.navigate('AccessibilitySurvey', { returnTo: 'back' }) },
    { label: 'FAQ', icon: 'help-circle-outline', onPress: () => handleInfoPagePress('faq') },
    { label: 'Contact Us', icon: 'mail-outline', onPress: () => handleInfoPagePress('contact') },
    { label: 'Terms of Use', icon: 'document-text-outline', onPress: () => handleInfoPagePress('terms') },
    { label: 'Privacy Policy', icon: 'shield-outline', onPress: () => handleInfoPagePress('privacy') },
    { label: 'Community Guidelines', icon: 'people-outline', onPress: () => handleInfoPagePress('guidelines') },
    { label: 'Safety Tips', icon: 'warning-outline', onPress: () => handleInfoPagePress('safety') },
    // Manage Subscription + Restore Purchases are gated on
    // SHOW_PAYMENTS_UI (src/payments/comingSoon.js). With payments
    // live they render unconditionally; the flag stays as a kill
    // switch in case we need to hide monetization UI for a future
    // App Review re-submission.
    ...(SHOW_PAYMENTS_UI
      ? [
          { label: 'Manage Subscription', icon: 'card-outline', onPress: handleManageSubscription },
          { label: 'Restore Purchases', icon: 'refresh-outline', onPress: handleRestore },
        ]
      : []),
    { label: 'Manage Account', icon: 'person-outline', onPress: handleManageAccount },
  ], [handleInfoPagePress, handleManageAccount, handleManageSubscription, handleRestore, navigation]);
  const surveySnapshot = useMemo(() => [
    { label: 'Mode', value: mode },
    { label: 'Looking For', value: lookingFor },
    { label: 'Distance', value: `${currentUser.preferences?.distance || 50} mi` },
    { label: 'Age Range', value: `${currentUser.preferences?.ageRange?.[0] || 21}-${currentUser.preferences?.ageRange?.[1] || 30}` },
    { label: 'Show Me on JuNubin', value: showMe ? 'On' : 'Off' },
  ], [mode, lookingFor, showMe]);
  const appChanges = useMemo(() => [
    { label: 'Theme', value: isDark ? 'Dark' : 'Light' },
    { label: 'Membership', value: tierLabel },
    { label: 'Spotlights', value: `${spotlights}` },
    { label: 'Super Likes', value: `${superLikes}` },
  ], [isDark, tierLabel, spotlights, superLikes]);

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
            <MaterialCommunityIcons name="crown" size={18} color={colors.gold} />
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
              title="GET JUNUBIN+"
              subtitle="Unlimited Likes and Rewinds"
              variant="outline"
              size="md"
              textStyle={{ letterSpacing: 1 }}
              onPress={() => navigation.navigate('Elite')}
            />
          )}
        </View>

        {SHOW_PAYMENTS_UI && (
          <View style={styles.boostRow}>
            <TouchableOpacity style={styles.boostCard} onPress={() => navigation.navigate('Boost')}>
              <GraffitiFlame size={24} color={colors.accent} filled />
              <Text style={styles.boostCardText}>GET MORE{'\n'}SPOTLIGHTS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.superLikeCard} onPress={() => navigation.navigate('Elite')}>
              <MaterialCommunityIcons name="crown" size={24} color={colors.gold} />
              <Text style={styles.boostCardText}>GET MORE{'\n'}SUPER LIKES</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Others */}
        <View style={styles.othersSection}>
          <Text style={styles.othersTitle}>Others</Text>

          <PressableRow style={styles.menuRow} onPress={() => handleInfoPagePress('contact')}>
            <Text style={styles.menuLabel}>Email</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>

          {/* Push notifications — distinct from the (deferred) in-app
              notification feed. The OS-level permission powers the real
              push pipeline (00013 triggers → push-send). Tapping this
              row either prompts the user the first time, or opens the
              system Settings if they've already denied. */}
          <PressableRow
            style={styles.menuRow}
            onPress={async () => {
              const status = await getNotificationPermissionStatus();
              if (status === 'granted') {
                Alert.alert(
                  'Notifications on',
                  'You\'ll get a heads-up when someone matches with you, sends a message, or likes your post.',
                );
                return;
              }
              if (status === 'denied') {
                promptToOpenSettings({
                  title: 'Notifications turned off',
                  message: 'Open Settings to let JuNubin send you push notifications about matches, messages, and likes.',
                });
                return;
              }
              const token = await promptForPushPermission();
              if (token) {
                Alert.alert('Notifications on', 'You\'re all set.');
              } else {
                promptToOpenSettings({
                  title: 'Notifications still off',
                  message: 'You can enable JuNubin notifications in Settings whenever you change your mind.',
                });
              }
            }}
          >
            <Text style={styles.menuLabel}>Push Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>

          <PressableRow style={styles.menuRow} onPress={() => navigation.navigate('GameSettings')}>
            <Text style={styles.menuLabel}>Game Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Show me on JuNubin</Text>
              <Text style={styles.switchDesc}>
                While turned off, you will not be shown in the card stack.
              </Text>
            </View>
            <Switch
              value={showMe}
              onValueChange={handleShowMeToggle}
              trackColor={{ false: colors.gray300, true: colors.black }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Appear on map</Text>
              <Text style={styles.switchDesc}>
                Show me on the Connect map (location rounded to ~110m). Off by default.
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: colors.gray300, true: colors.black }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Incognito Mode</Text>
              <Text style={styles.switchDesc}>
                Browse without appearing in others' card stacks. Junub tier required.
              </Text>
            </View>
            <Switch
              value={incognito}
              onValueChange={(val) => {
                if (val && !canUseIncognito()) {
                  Alert.alert(
                    'Junub Feature',
                    'Incognito Mode is available on the Junub tier. Upgrade to browse privately.',
                    [
                      { text: 'See Plans', onPress: () => navigation.navigate('Elite') },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                  return;
                }
                setIncognito(val);
              }}
              trackColor={{ false: colors.gray300, true: colors.black }}
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
              trackColor={{ false: colors.gray300, true: colors.black }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Distance Unit</Text>
              <Text style={styles.switchDesc}>
                {distanceUnit === 'mi' ? 'Miles' : 'Kilometers'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.unitToggle}
              onPress={() => setDistanceUnit(u => u === 'mi' ? 'km' : 'mi')}
              activeOpacity={0.7}
            >
              <Text style={styles.unitToggleText}>{distanceUnit.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>

          <PressableRow style={styles.menuRow} onPress={handleViewBlocked}>
            <Text style={styles.menuLabel}>Blocked Users</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
          </PressableRow>
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

        {/* Delete account */}
        <PressableRow style={styles.menuRow} onPress={() => {
          Alert.alert(
            'Delete Account',
            'Are you sure? This will permanently delete your account and all your data. This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Account',
                style: 'destructive',
                onPress: async () => {
                  // Hard delete via the account-delete Edge Function:
                  // tears down storage objects, the User row (FK
                  // cascades the rest), and the auth.users row. App
                  // Store guideline 5.1.1.v requires "real" deletion;
                  // soft-deletes leave the account discoverable and
                  // matchable, which violates that guideline.
                  let serverDeleted = false;
                  try {
                    if (session?.access_token) {
                      const { error } = await supabase.functions.invoke('account-delete', {
                        method: 'POST',
                      });
                      if (!error) serverDeleted = true;
                    }
                  } catch (e) {
                    if (__DEV__) console.warn('account-delete failed:', e);
                  }
                  // If the Edge Function isn't deployed yet (early dev)
                  // fall back to the soft-delete flag so the in-app
                  // sign-out still happens. The flag isn't filtered on
                  // reads anywhere — surfaced here only so the prior
                  // behavior is preserved during deploy.
                  if (!serverDeleted) {
                    try {
                      if (session) {
                        await profileService.updateProfile({ deletedAt: new Date().toISOString() });
                      }
                    } catch {}
                  }
                  await logout();
                        await reset();
                },
              },
            ]
          );
        }}>
          <Text style={[styles.menuLabel, { color: colors.error }]}>Delete Account</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
        </PressableRow>

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
    backgroundColor: colors.surfaceMuted,
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
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    flex: 1,
    textAlign: 'center',
  },
  doneText: {
    ...Typography.bodySemibold,
    color: colors.black,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    ...getShadow('sm', isDark),
  },
  tierBadgeText: {
    ...Typography.label,
    color: colors.black,
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
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
    ...getShadow('sm', isDark),
  },
  superLikeCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
    ...getShadow('sm', isDark),
  },
  boostCardText: {
    ...Typography.captionBold,
    color: colors.black,
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
    color: colors.gray500,
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
    backgroundColor: colors.black,
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
    backgroundColor: colors.black,
    shadowColor: colors.black,
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
    borderColor: colors.black,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F6',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.black,
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
    color: colors.gray500,
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
    color: colors.gray500,
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
  unitToggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.black,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.cardBg,
    letterSpacing: 0.5,
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
