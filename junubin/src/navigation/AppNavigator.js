import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { useAuth } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLinkTo } from '@react-navigation/native';
import { hapticSelection } from '../utils/haptics';
import * as pendingDeepLink from '../utils/pendingDeepLink';
import { getProfileRecord } from '../utils/eligibility';
import LogoMark from '../components/LogoMark';
import ErrorBoundary from '../components/ErrorBoundary';
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

// Lazy-loaded screens (behind navigation.navigate)
function LazyFallback() {
  return (
    <View style={styles.bootLoading}>
      <LogoMark size={48} />
      <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" style={{ marginTop: 16 }} />
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
const ProfileDetailScreen = lazify(() => import('../screens/ProfileDetailScreen'));
const ProfileViewScreen = lazify(() => import('../screens/ProfileViewScreen'));
const SettingsScreen = lazify(() => import('../screens/SettingsScreen'));
const PreferencesScreen = lazify(() => import('../screens/PreferencesScreen'));
const ChatScreen = withBoundary(lazify(() => import('../screens/ChatScreen')), 'chat');
const MessageRequestsScreen = lazify(() => import('../screens/MessageRequestsScreen'));
const EditProfileScreen = lazify(() => import('../screens/EditProfileScreen'));
const NotificationsScreen = lazify(() => import('../screens/NotificationsScreen'));
const SettingsInfoScreen = lazify(() => import('../screens/SettingsInfoScreen'));
const AccessibilitySurveyScreen = lazify(() => import('../screens/AccessibilitySurveyScreen'));
const PreferenceSelectScreen = lazify(() => import('../screens/PreferenceSelectScreen'));
const PhotoVerificationScreen = lazify(() => import('../screens/PhotoVerificationScreen'));
const ReferralScreen = lazify(() => import('../screens/ReferralScreen'));
const FollowListScreen = lazify(() => import('../screens/FollowListScreen'));
const FindFriendsScreen = lazify(() => import('../screens/FindFriendsScreen'));
const WebViewScreen = lazify(() => import('../screens/WebViewScreen'));

// ─── Routes deliberately NOT registered ───
// JuNubin is a people-discovery + text-chat app. These screens still
// exist on disk (some are referenced by tests, and deleting them is a
// separate cleanup) but they are unreachable, which is the point:
//
//   Feed / community : CommunityScreen, CreatePost, PostDetail,
//                      CreateStory, StoriesView, VideoReels,
//                      CreateGroup, GroupDetail
//   Games            : InteractivityHub, GameSettings
//   Calls            : Call (voice/video), which is why there is no
//                      `Call` route — chat is text-only
//   Dating           : LikesScreen (the Likes tab is now Directory)
//   Payments         : Elite, Boost — the app is free, nothing is sold
//
// If you re-register one of these, you are changing the product, not
// fixing a bug. Talk to product first.

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();
const MainStack = createStackNavigator();

function HomeTabs() {
  const { colors } = useTheme();
  const tabStyles = useMemo(() => getTabStyles(), []);
  // Three tabs, one job each: find people near me, search for people
  // anywhere, talk to the people I found.
  const TAB_NAMES = ['HomeTab', 'DirectoryTab', 'MessagesTab'];
  const tabScales = useRef(TAB_NAMES.map(() => new Animated.Value(1))).current;

  return (
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: FontFamily.semibold,
            fontWeight: '600',
            marginTop: -2,
          },
          tabBarActiveTintColor: colors.black,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.cream,
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 22 : 12,
            paddingTop: Platform.OS === 'ios' ? 10 : 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 6,
          },
          tabBarIcon: ({ focused }) => {
            const idx = TAB_NAMES.indexOf(route.name);
            const scaleValue = idx >= 0 ? tabScales[idx] : new Animated.Value(1);
            const iconColor = focused ? colors.tabActive : colors.tabInactive;
            const size = 28;

            let icon;
            switch (route.name) {
              case 'HomeTab':
                // map-marker-radius — a pin with a radius ring, which is
                // literally what the tab shows: people around a point.
                icon = <MaterialCommunityIcons name={focused ? 'map-marker-radius' : 'map-marker-radius-outline'} size={size + 2} color={iconColor} />;
                break;
              case 'DirectoryTab':
                icon = <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={iconColor} />;
                break;
              case 'MessagesTab':
                icon = <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={size} color={iconColor} />;
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
      </Tab.Navigator>
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
      <MainStack.Screen name="ProfileView" component={ProfileViewScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: true }} />
      <MainStack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Preferences" component={PreferencesScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Chat" component={ChatScreen} />
      <MainStack.Screen name="MessageRequests" component={MessageRequestsScreen} />
      <MainStack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="SettingsInfo" component={SettingsInfoScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="AccessibilitySurvey" component={AccessibilitySurveyScreen} options={{ presentation: 'modal', gestureEnabled: true }} />
      <MainStack.Screen name="PreferenceSelect" component={PreferenceSelectScreen} options={{ gestureEnabled: true }} />
      <MainStack.Screen name="PhotoVerification" component={PhotoVerificationScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Referral" component={ReferralScreen} />
      <MainStack.Screen name="FollowList" component={FollowListScreen} />
      <MainStack.Screen name="FindFriends" component={FindFriendsScreen} options={{ presentation: 'modal' }} />
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
  bootLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0C0C0E',
  },
});
