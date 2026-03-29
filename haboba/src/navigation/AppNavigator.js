import React, { useMemo, useRef, useState, useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, FontFamily, Typography } from '../theme';
import { useAuth } from '../auth';
import { hapticSelection, hapticLight } from '../utils/haptics';
import { GraffitiCommunity, GraffitiHeart, GraffitiChat } from '../components/icons';
import LogoMark from '../components/LogoMark';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
const InteractivityHubScreen = lazify(() => import('../screens/InteractivityHubScreen'));
const GameSettingsScreen = lazify(() => import('../screens/GameSettingsScreen'));
const GoLiveScreen = lazify(() => import('../screens/GoLiveScreen'));
const LiveViewScreen = lazify(() => import('../screens/LiveViewScreen'));
const FollowListScreen = lazify(() => import('../screens/FollowListScreen'));
const FindFriendsScreen = lazify(() => import('../screens/FindFriendsScreen'));

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();
const MainStack = createStackNavigator();

// Placeholder for the center FAB tab (never actually rendered)
const EmptyScreen = () => <View style={{ flex: 1 }} />;

function HomeTabs() {
  const { colors, isDark } = useTheme();
  const tabStyles = useMemo(() => getTabStyles(colors, isDark), [colors, isDark]);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [currentMode, setCurrentMode] = useState('Dating');
  const TAB_NAMES = ['HomeTab', 'CommunityTab', 'ModeToggle', 'LikesTab', 'MessagesTab'];
  const tabScales = useRef(TAB_NAMES.map(() => new Animated.Value(1))).current;

  // Read persisted mode on mount
  React.useEffect(() => {
    AsyncStorage.getItem('@haboba_mode').then((stored) => {
      if (stored === 'Social' || stored === 'Dating') setCurrentMode(stored);
    });
  }, []);

  const handleModeSelect = useCallback(async (mode) => {
    hapticLight();
    setCurrentMode(mode);
    setModeSheetOpen(false);
    try { await AsyncStorage.setItem('@haboba_mode', mode); } catch {}
  }, []);

  return (
    <>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            fontFamily: FontFamily.semibold,
            letterSpacing: 0.3,
            marginTop: -2,
          },
          tabBarActiveTintColor: route.name === 'LikesTab' ? colors.accent : colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 0.5,
            borderTopColor: colors.separator,
            height: Platform.OS === 'ios' ? 80 : 64,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
            paddingTop: 6,
            shadowColor: colors.gray700,
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
            elevation: 10,
          },
          tabBarIcon: ({ focused }) => {
            const idx = TAB_NAMES.indexOf(route.name);
            const scaleValue = idx >= 0 ? tabScales[idx] : new Animated.Value(1);

            // Center FAB — raised gradient button
            if (route.name === 'ModeToggle') {
              return (
                <Animated.View style={[tabStyles.fabWrap, { transform: [{ scale: scaleValue }] }]}>
                  <LinearGradient
                    colors={['#CE1126', '#009739']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={tabStyles.fab}
                  >
                    <Ionicons name="swap-horizontal" size={22} color="#FFFFFF" />
                  </LinearGradient>
                </Animated.View>
              );
            }

            const activeColor = route.name === 'LikesTab' ? colors.accent : colors.tabActive;
            const iconColor = focused ? activeColor : colors.tabInactive;
            const size = 22;

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
                {focused && <View style={[tabStyles.activeBar, { backgroundColor: activeColor }]} />}
              </Animated.View>
            );
          },
        })}
        screenListeners={({ route }) => ({
          tabPress: (e) => {
            if (route.name === 'ModeToggle') {
              e.preventDefault();
              hapticSelection();
              setModeSheetOpen(true);
              return;
            }
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
        <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Connect' }} />
        <Tab.Screen name="CommunityTab" component={CommunityScreen} options={{ tabBarLabel: 'Community' }} />
        <Tab.Screen name="ModeToggle" component={EmptyScreen} options={{ tabBarLabel: '' }} />
        <Tab.Screen name="LikesTab" component={LikesScreen} options={{ tabBarLabel: 'Likes' }} />
        <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Messages' }} />
      </Tab.Navigator>

      {/* Mode Toggle Bottom Sheet */}
      <Modal
        visible={modeSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModeSheetOpen(false)}
      >
        <Pressable style={tabStyles.sheetOverlay} onPress={() => setModeSheetOpen(false)}>
          <View style={tabStyles.sheetContainer}>
            <View style={tabStyles.sheetHandle} />
            <Text style={tabStyles.sheetTitle}>Choose Mode</Text>
            {['Dating', 'Social'].map((mode) => {
              const isActive = currentMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[tabStyles.sheetOption, isActive && tabStyles.sheetOptionActive]}
                  onPress={() => handleModeSelect(mode)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={mode === 'Dating' ? 'heart' : 'people'}
                    size={22}
                    color={isActive ? '#FFFFFF' : colors.gray500}
                  />
                  <View>
                    <Text style={[tabStyles.sheetOptionLabel, isActive && tabStyles.sheetOptionLabelActive]}>
                      {mode}
                    </Text>
                    <Text style={tabStyles.sheetOptionDesc}>
                      {mode === 'Dating' ? 'Find meaningful connections' : 'Meet friends & join communities'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
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
      <MainStack.Screen name="InteractivityHub" component={InteractivityHubScreen} />
      <MainStack.Screen name="GameSettings" component={GameSettingsScreen} options={{ presentation: 'modal' }} />
      <MainStack.Screen name="GoLive" component={GoLiveScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <MainStack.Screen name="LiveView" component={LiveViewScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: true }} />
      <MainStack.Screen name="FollowList" component={FollowListScreen} />
      <MainStack.Screen name="FindFriends" component={FindFriendsScreen} options={{ presentation: 'modal' }} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, user, ready, devBypass } = useAuth();

  if (!ready) return null;

  const profile = user?.profile;
  const hasProfile =
    profile?.profileComplete ||
    profile?.accountPurpose ||
    profile?.displayName ||
    user?.displayName;
  const needsProfileSetup = isAuthenticated && !hasProfile && !devBypass;

  if (!isAuthenticated) {
    return <AuthNavigator initialRouteName="Onboarding" />;
  }

  return needsProfileSetup
    ? <MainNavigator initialRouteName="ProfileSetup" />
    : <MainNavigator initialRouteName="Main" />;
}

const getTabStyles = (colors, isDark) => StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 36,
  },
  activeBar: {
    width: 20,
    height: 2.5,
    borderRadius: 1.5,
    marginTop: 4,
  },
  // Center FAB
  fabWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 18,
    shadowColor: '#CE1126',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Mode toggle sheet
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    ...Typography.h3,
    color: colors.primary,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: colors.surfaceMuted,
  },
  sheetOptionActive: {
    backgroundColor: colors.accent,
  },
  sheetOptionLabel: {
    ...Typography.bodySemibold,
    color: colors.primary,
  },
  sheetOptionLabelActive: {
    color: '#FFFFFF',
  },
  sheetOptionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: FontFamily.regular,
    marginTop: 2,
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
