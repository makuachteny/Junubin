import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLinkTo } from '@react-navigation/native';
import { hapticSelection } from '../utils/haptics';
import * as pendingDeepLink from '../utils/pendingDeepLink';
import { getProfileRecord } from '../utils/eligibility';
import ErrorBoundary from '../components/ErrorBoundary';
import { TabBarVisibilityProvider } from './TabBarVisibilityContext';
// Tab-bar screens stay eager — they render immediately when the user lands on
// `Main`. Auth-flow screens are eager too because Jest's CommonJS runtime
// cannot resolve `import()` callbacks; React.lazy on these breaks our snapshot
// + flow tests. Keeping them eager has minimal cost (parsed once at startup).
import HomeScreen from '../screens/HomeScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import MessagesScreen from '../screens/MessagesScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';

// Per-screen error boundary so a render crash inside one screen falls
// back to the boundary's retry surface instead of bubbling up to the
// root boundary and unmounting the whole nav tree (which logs the user
// out visually). Tag carries through to Sentry for triage.
function withBoundary(Component, tag) {
  return function ScreenWithBoundary(props) {
    return (
      <ErrorBoundary boundary={tag}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
const HomeScreenSafe = withBoundary(HomeScreen, 'home');
const DirectoryScreenSafe = withBoundary(DirectoryScreen, 'directory');
const MessagesScreenSafe = withBoundary(MessagesScreen, 'messages');
// ProfileTab wraps the same (lazy) ProfileScreen used by the "Profile"
// stack route — declared below, wrapped after `lazify` runs.

// Lazy-loaded screens (behind navigation.navigate)
function LazyFallback() {
  return (
    <View style={styles.bootLoading}>
      <Image source={SPLASH_IMAGE} style={styles.bootLogo} resizeMode="contain" />
      <ActivityIndicator size="small" color="rgba(255,255,255,0.62)" style={styles.bootSpinner} />
    </View>
  );
}

function lazify(importFn) {
  const LazyComponent = React.lazy(importFn);
  return function LazyScreen(props) {
    return (
      <React.Suspense fallback={<LazyFallback />}>
        <LazyComponent {...props} />
      </React.Suspense>
    );
  };
}

const ProfileScreen = lazify(() => import('../screens/ProfileScreen'));
const ProfileTabScreen = withBoundary(ProfileScreen, 'profile');
const ProfileDetailScreen = lazify(() => import('../screens/ProfileDetailScreen'));
const SettingsScreen = lazify(() => import('../screens/SettingsScreen'));
const ChatScreen = withBoundary(lazify(() => import('../screens/ChatScreen')), 'chat');
const EditProfileScreen = lazify(() => import('../screens/EditProfileScreen'));
const NotificationsScreen = lazify(() => import('../screens/NotificationsScreen'));
const SettingsInfoScreen = lazify(() => import('../screens/SettingsInfoScreen'));
const PhotoVerificationScreen = lazify(() => import('../screens/PhotoVerificationScreen'));
const WebViewScreen = lazify(() => import('../screens/WebViewScreen'));

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();
const MainStack = createStackNavigator();
const SPLASH_IMAGE = require('../../assets/splash.png');

function MessageRequestsRedirect({ navigation }) {
  useEffect(() => {
    navigation.replace('Main', {
      screen: 'MessagesTab',
      params: { segment: 'requests' },
    });
  }, [navigation]);

  return <LazyFallback />;
}

function AutoHideTabBar(props) {
  const { visible, reveal, ...tabBarProps } = props;

  if (!visible) {
    return (
      <TouchableOpacity
        style={styles.tabRevealZone}
        onPress={reveal}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel="Show navigation"
        testID="tab-reveal-zone"
      />
    );
  }

  return <BottomTabBar {...tabBarProps} />;
}

function HomeTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabStyles = useMemo(() => getTabStyles(), []);
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const restoreTimerRef = useRef(null);
  // Four tabs, one job each: find people near me, search for people
  // anywhere, talk to the people I found, tend my own profile. Nearby
  // (the map) is the initial tab — JuNubin's first job on open is
  // "who is around me", and the map answers that before any list does.
  const TAB_NAMES = ['HomeTab', 'DirectoryTab', 'MessagesTab', 'ProfileTab'];
  const tabScales = useRef(TAB_NAMES.map(() => new Animated.Value(1))).current;

  const showTabBar = useCallback(() => {
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    setTabBarVisible(true);
  }, []);

  const revealTabBar = useCallback(() => {
    hapticSelection();
    showTabBar();
  }, [showTabBar]);

  const hideTabBarForScroll = useCallback(() => {
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    setTabBarVisible(false);
  }, []);

  const showTabBarAfterScroll = useCallback(() => {
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = setTimeout(() => setTabBarVisible(true), 260);
  }, []);

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    };
  }, []);

  return (
    <TabBarVisibilityProvider
      hideForScroll={hideTabBarForScroll}
      showAfterScroll={showTabBarAfterScroll}
    >
      <Tab.Navigator
        initialRouteName="HomeTab"
        tabBar={(props) => (
          <AutoHideTabBar {...props} visible={tabBarVisible} reveal={revealTabBar} />
        )}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontFamily: FontFamily.semibold,
            fontWeight: '600',
            letterSpacing: 0.5,
            marginTop: -2,
          },
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.tabBarBg,
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 76 : 64,
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10),
            paddingTop: 8,
            elevation: 0,
            shadowColor: '#000',
            shadowOpacity: 0,
          },
          // Chats unread badge (set via navigation.setOptions from
          // MessagesScreen): small flag-red pill, white numeral.
          tabBarBadgeStyle: {
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.ssRed,
            color: '#FFFFFF',
            fontSize: 10,
            fontFamily: FontFamily.bold,
            fontWeight: '700',
            lineHeight: 15,
          },
          tabBarIcon: ({ focused }) => {
            const idx = TAB_NAMES.indexOf(route.name);
            const scaleValue = idx >= 0 ? tabScales[idx] : new Animated.Value(1);
            const iconColor = focused ? colors.tabActive : colors.tabInactive;
            // Thin-stroke outline icons in both states — the Industry
            // tab bar signals "active" with color, not a filled glyph.
            const size = 23;

            let icon;
            switch (route.name) {
              case 'HomeTab':
                icon = <Ionicons name="location-outline" size={size} color={iconColor} />;
                break;
              case 'DirectoryTab':
                icon = <Ionicons name="search-outline" size={size} color={iconColor} />;
                break;
              case 'MessagesTab':
                icon = <Ionicons name="chatbubble-outline" size={size} color={iconColor} />;
                break;
              case 'ProfileTab':
                icon = <Ionicons name="person-outline" size={size} color={iconColor} />;
                break;
              default:
                icon = null;
            }

            return (
              <Animated.View style={[tabStyles.tabIcon, { transform: [{ scale: scaleValue }] }]}>
                {icon}
              </Animated.View>
            );
          },
        })}
        screenListeners={({ route }) => ({
          tabPress: () => {
            hapticSelection();
            const idx = TAB_NAMES.indexOf(route.name);
            if (idx >= 0) {
              const scale = tabScales[idx];
              scale.setValue(0.85);
              Animated.spring(scale, {
                toValue: 1,
                tension: 200,
                friction: 8,
                useNativeDriver: true,
              }).start();
            }
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={HomeScreenSafe} options={{ tabBarLabel: 'Nearby' }} />
        <Tab.Screen name="DirectoryTab" component={DirectoryScreenSafe} options={{ tabBarLabel: 'Directory' }} />
        <Tab.Screen name="MessagesTab" component={MessagesScreenSafe} options={{ tabBarLabel: 'Chats' }} />
        {/* Same ProfileScreen component as the "Profile" stack route —
            the tab is just a second door into it. Other screens keep
            navigating to the stack route; both stay registered. */}
        <Tab.Screen name="ProfileTab" component={ProfileTabScreen} options={{ tabBarLabel: 'Profile' }} />
      </Tab.Navigator>
    </TabBarVisibilityProvider>
  );
}

function AuthNavigator({ initialRouteName = 'Onboarding' }) {
  return (
    <AuthStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, layouts }) => ({
          cardStyle: {
            opacity: current.progress,
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [layouts.screen.width * 0.08, 0],
                }),
              },
            ],
          },
        }),
      }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
      <AuthStack.Screen name="SettingsInfo" component={SettingsInfoScreen} />
      <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator({ initialRouteName = 'Main' }) {
  return (
    <MainStack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, layouts }) => ({
          cardStyle: {
            opacity: current.progress,
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [layouts.screen.width * 0.08, 0],
                }),
              },
            ],
          },
        }),
      }}
    >
      <MainStack.Screen name="Main" component={HomeTabs} />
      <MainStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <MainStack.Screen name="Profile" component={ProfileScreen} />
      <MainStack.Screen name="ProfileDetail" component={ProfileDetailScreen} options={{ presentation: 'modal', gestureEnabled: true }} />
      <MainStack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Chat" component={ChatScreen} />
      <MainStack.Screen name="MessageRequests" component={MessageRequestsRedirect} />
      <MainStack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="SettingsInfo" component={SettingsInfoScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="PhotoVerification" component={PhotoVerificationScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="WebView" component={WebViewScreen} options={{ presentation: 'modal' }} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, user, ready } = useAuth();
  // Load before mounting AuthNavigator. React Navigation only reads
  // initialRouteName on first mount, so rendering with a temporary
  // false value can strand returning users on the landing page even
  // after AsyncStorage later says they already onboarded.
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const linkTo = useLinkTo();

  useEffect(() => {
    AsyncStorage.getItem('@junubin_onboarded').then((val) => {
      setHasOnboarded(val === 'true');
    }).catch(() => setHasOnboarded(false));
  }, []);

  // Replay any deep link that was deferred while the user was on the
  // auth stack. Fires once auth is ready, the user object has loaded,
  // and the profile is complete enough to land on a real screen. If
  // the user is mid-profile-setup we leave the link queued — the
  // effect re-fires when `user` updates with the completed profile.
  // Linking errors are swallowed: better to drop a pending tap than
  // to crash the app on a stale URL.
  const profileForDeepLink = getProfileRecord(user);
  const profileReady = !!(
    profileForDeepLink?.profileComplete ||
    profileForDeepLink?.accountPurpose ||
    profileForDeepLink?.displayName ||
    user?.displayName
  );
  useEffect(() => {
    if (!isAuthenticated || !user || !profileReady) return;
    let cancelled = false;
    pendingDeepLink.consumePending().then((url) => {
      if (cancelled || !url) return;
      const path = pendingDeepLink.pathFromUrl(url);
      if (!path) return;
      try { linkTo('/' + path); } catch {}
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthenticated, user, profileReady, linkTo]);

  // Wipe any queued link when the user signs out, so a freshly-signed-in
  // account doesn't inherit the previous user's pending tap.
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      pendingDeepLink.clearPending().catch(() => {});
    }
  }, [ready, isAuthenticated]);

  if (!ready || hasOnboarded === null) return <LazyFallback />;

  if (!isAuthenticated) {
    const initialRouteName = hasOnboarded ? 'Signup' : 'Onboarding';
    return <AuthNavigator key={`auth-${initialRouteName}`} initialRouteName={initialRouteName} />;
  }

  // Authenticated but the API user fetch is still in flight. Without
  // this guard the navigator briefly renders Main (because hasProfile
  // is false → needsProfileSetup is true → ProfileSetup mounts) and
  // then unmounts/swaps once `user` arrives — a visible flash and a
  // potential redirect loop. Wait for the user object to land first.
  if (user === null || user === undefined) return <LazyFallback />;

  const profile = getProfileRecord(user);
  const hasProfile =
    profile?.profileComplete ||
    profile?.accountPurpose ||
    profile?.displayName ||
    user?.displayName;
  const needsProfileSetup = !hasProfile;

  return needsProfileSetup
    ? <MainNavigator initialRouteName="ProfileSetup" />
    : <MainNavigator initialRouteName="Main" />;
}

const getTabStyles = () => StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 38,
  },
});

const styles = StyleSheet.create({
  tabRevealZone: {
    height: 24,
    backgroundColor: 'transparent',
  },
  bootLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  bootLogo: {
    width: 128,
    height: 128,
  },
  bootSpinner: {
    marginTop: 20,
  },
});
