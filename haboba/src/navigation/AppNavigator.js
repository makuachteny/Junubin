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
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { useAuth } from '../auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticSelection } from '../utils/haptics';
import { GraffitiCommunity, GraffitiHeart, GraffitiChat } from '../components/icons';
import LogoMark from '../components/LogoMark';
// Screens - Onboarding flow (eager — auth flow)
import OnboardingScreen from '../screens/OnboardingScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
// Screens - Tab bar (eager — initial render)
import HomeScreen from '../screens/HomeScreen';
import LikesScreen from '../screens/LikesScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CommunityScreen from '../screens/CommunityScreen';

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
const SettingsScreen = lazify(() => import('../screens/SettingsScreen'));
const PreferencesScreen = lazify(() => import('../screens/PreferencesScreen'));
const BoostScreen = lazify(() => import('../screens/BoostScreen'));
const EliteScreen = lazify(() => import('../screens/EliteScreen'));
const ChatScreen = lazify(() => import('../screens/ChatScreen'));
const CreatePostScreen = lazify(() => import('../screens/CreatePostScreen'));
const PostDetailScreen = lazify(() => import('../screens/PostDetailScreen'));
const GroupDetailScreen = lazify(() => import('../screens/GroupDetailScreen'));
const EditProfileScreen = lazify(() => import('../screens/EditProfileScreen'));
const NotificationsScreen = lazify(() => import('../screens/NotificationsScreen'));
const SettingsInfoScreen = lazify(() => import('../screens/SettingsInfoScreen'));
const PreferenceSelectScreen = lazify(() => import('../screens/PreferenceSelectScreen'));
const AccessibilitySurveyScreen = lazify(() => import('../screens/AccessibilitySurveyScreen'));
const CallScreen = lazify(() => import('../screens/CallScreen'));
const PhotoVerificationScreen = lazify(() => import('../screens/PhotoVerificationScreen'));
const ReferralScreen = lazify(() => import('../screens/ReferralScreen'));
const StoriesViewScreen = lazify(() => import('../screens/StoriesViewScreen'));
const CreateStoryScreen = lazify(() => import('../screens/CreateStoryScreen'));
const EventsScreen = lazify(() => import('../screens/EventsScreen'));
const EventDetailScreen = lazify(() => import('../screens/EventDetailScreen'));
const CreateEventScreen = lazify(() => import('../screens/CreateEventScreen'));
const CreateGroupScreen = lazify(() => import('../screens/CreateGroupScreen'));
const InteractivityHubScreen = lazify(() => import('../screens/InteractivityHubScreen'));
const GameSettingsScreen = lazify(() => import('../screens/GameSettingsScreen'));
const GoLiveScreen = lazify(() => import('../screens/GoLiveScreen'));
const LiveViewScreen = lazify(() => import('../screens/LiveViewScreen'));
const FollowListScreen = lazify(() => import('../screens/FollowListScreen'));
const FindFriendsScreen = lazify(() => import('../screens/FindFriendsScreen'));
const WebViewScreen = lazify(() => import('../screens/WebViewScreen'));

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();
const MainStack = createStackNavigator();

function HomeTabs() {
  const { colors } = useTheme();
  const tabStyles = useMemo(() => getTabStyles(), []);
  const TAB_NAMES = ['HomeTab', 'CommunityTab', 'LikesTab', 'MessagesTab'];
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
          tabBarActiveTintColor: route.name === 'LikesTab' ? colors.accent : colors.black,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopWidth: 0,
            height: Platform.OS === 'ios' ? 88 : 68,
            paddingBottom: Platform.OS === 'ios' ? 26 : 10,
            paddingTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 6,
          },
          tabBarIcon: ({ focused }) => {
            const idx = TAB_NAMES.indexOf(route.name);
            const scaleValue = idx >= 0 ? tabScales[idx] : new Animated.Value(1);
            const activeColor = route.name === 'LikesTab' ? colors.accent : colors.tabActive;
            const iconColor = focused ? activeColor : colors.tabInactive;
            const size = 28;

            let icon;
            switch (route.name) {
              case 'HomeTab':
                icon = <Ionicons name={focused ? 'earth' : 'earth-outline'} size={size} color={iconColor} />;
                break;
              case 'CommunityTab':
                icon = <GraffitiCommunity size={size} color={iconColor} filled={focused} />;
                break;
              case 'LikesTab':
                icon = <GraffitiHeart size={size} color={iconColor} filled={focused} />;
                break;
              case 'MessagesTab':
                icon = <GraffitiChat size={size} color={iconColor} filled={focused} />;
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
        <Tab.Screen name="CommunityTab" component={CommunityScreen} options={{ tabBarLabel: 'Community' }} />
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Discover' }} />
        <Tab.Screen name="LikesTab" component={LikesScreen} options={{ tabBarLabel: 'Likes' }} />
        <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Chats' }} />
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
      <AuthStack.Screen name="AccessibilitySurvey" component={AccessibilitySurveyScreen} />
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
      <MainStack.Screen name="Preferences" component={PreferencesScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Boost" component={BoostScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Elite" component={EliteScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Chat" component={ChatScreen} />
      <MainStack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="PostDetail" component={PostDetailScreen} options={{ presentation: 'modal', gestureEnabled: true }} />
      <MainStack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <MainStack.Screen name="EditProfile" component={EditProfileScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="SettingsInfo" component={SettingsInfoScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="PreferenceSelect" component={PreferenceSelectScreen} options={{ gestureEnabled: true }} />
      <MainStack.Screen name="Call" component={CallScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <MainStack.Screen name="PhotoVerification" component={PhotoVerificationScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Referral" component={ReferralScreen} />
      <MainStack.Screen name="StoriesView" component={StoriesViewScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: true }} />
      <MainStack.Screen name="CreateStory" component={CreateStoryScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="Events" component={EventsScreen} />
      <MainStack.Screen name="EventDetail" component={EventDetailScreen} options={{ presentation: 'modal', gestureEnabled: true }} />
      <MainStack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="InteractivityHub" component={InteractivityHubScreen} />
      <MainStack.Screen name="GameSettings" component={GameSettingsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="GoLive" component={GoLiveScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <MainStack.Screen name="LiveView" component={LiveViewScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: true }} />
      <MainStack.Screen name="FollowList" component={FollowListScreen} />
      <MainStack.Screen name="FindFriends" component={FindFriendsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="WebView" component={WebViewScreen} options={{ presentation: 'modal' }} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, user, ready, devBypass } = useAuth();
  const [hasOnboarded, setHasOnboarded] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('@haboba_onboarded').then((val) => {
      setHasOnboarded(val === 'true');
    }).catch(() => setHasOnboarded(false));
  }, []);

  if (!ready || hasOnboarded === null) return null;

  const profile = user?.profile;
  const hasProfile =
    profile?.profileComplete ||
    profile?.accountPurpose ||
    profile?.displayName ||
    user?.displayName;
  const needsProfileSetup = isAuthenticated && !hasProfile && !devBypass;

  if (!isAuthenticated) {
    return <AuthNavigator initialRouteName={hasOnboarded ? 'Signup' : 'Onboarding'} />;
  }

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
