import React, { useMemo, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet, Platform, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { useTheme, FontFamily } from '../theme';
import { GraffitiHeart, GraffitiLocation, GraffitiChat, GraffitiCommunity } from '../components/icons';
import { useAuth } from '../auth';
import { hapticSelection } from '../utils/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_COUNT = 4;

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
function lazify(importFn) {
  const LazyComponent = React.lazy(importFn);
  return function LazyScreen(props) {
    return (
      <React.Suspense fallback={<View style={styles.bootLoading}><ActivityIndicator size="large" color="#F56040" /></View>}>
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
// New screens
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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeTabs() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const likesPink = colors.accent;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current; // Start on HomeTab (index 0)
  const TAB_NAMES = ['HomeTab', 'CommunityTab', 'MessagesTab', 'LikesTab'];
  const tabScales = useRef(TAB_NAMES.map(() => new Animated.Value(1))).current;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: -2,
        },
        tabBarActiveTintColor: route.name === 'LikesTab' ? likesPink : colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 92 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          shadowColor: colors.gray700,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarIcon: ({ focused }) => {
          const activeColor = route.name === 'LikesTab' ? likesPink : colors.tabActive;
          const iconColor = focused ? activeColor : colors.tabInactive;
          const idx = TAB_NAMES.indexOf(route.name);
          const scaleValue = idx >= 0 ? tabScales[idx] : new Animated.Value(1);

          let IconComponent;
          switch (route.name) {
            case 'HomeTab':
              IconComponent = GraffitiLocation;
              break;
            case 'LikesTab':
              IconComponent = GraffitiHeart;
              break;
            case 'CommunityTab':
              IconComponent = GraffitiCommunity;
              break;
            case 'MessagesTab':
              IconComponent = GraffitiChat;
              break;
          }

          return (
            <Animated.View style={[styles.tabIcon, focused && styles.tabIconFocused, { transform: [{ scale: scaleValue }] }]}>
              {IconComponent && <IconComponent size={26} color={iconColor} filled={focused} />}
              {focused && <View style={[styles.activeDot, { backgroundColor: activeColor }]} />}
            </Animated.View>
          );
        },
      })}
      screenListeners={({ route }) => ({
        tabPress: () => {
          hapticSelection();
          const idx = TAB_NAMES.indexOf(route.name);
          if (idx >= 0) {
            // Scale bounce animation
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
        focus: () => {
          const idx = TAB_NAMES.indexOf(route.name);
          if (idx >= 0) {
            Animated.spring(tabIndicatorAnim, {
              toValue: idx,
              tension: 68,
              friction: 10,
              useNativeDriver: true,
            }).start();
          }
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="LikesTab" component={LikesScreen} options={{ tabBarLabel: 'Likes' }} />
      <Tab.Screen name="CommunityTab" component={CommunityScreen} options={{ tabBarLabel: 'Community' }} />
      <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Chat' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();

  // Authenticated users go straight to Main (even if profile is incomplete,
  // they can finish it later — don't loop them through onboarding again)
  const initialRoute = isAuthenticated ? 'Main' : 'Onboarding';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
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
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="AccessibilitySurvey" component={AccessibilitySurveyScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Main" component={HomeTabs} />
      {/* Main app and modals */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen
        name="ProfileDetail"
        component={ProfileDetailScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Preferences"
        component={PreferencesScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Boost"
        component={BoostScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Elite"
        component={EliteScreen}
        options={{ presentation: 'modal' }}
      />
      {/* New screens */}
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="SettingsInfo"
        component={SettingsInfoScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="PreferenceSelect"
        component={PreferenceSelectScreen}
        options={{ gestureEnabled: true }}
      />
      {/* New feature screens */}
      <Stack.Screen
        name="Call"
        component={CallScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <Stack.Screen
        name="PhotoVerification"
        component={PhotoVerificationScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen
        name="StoriesView"
        component={StoriesViewScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="CreateStory"
        component={CreateStoryScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ presentation: 'modal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="InteractivityHub"
        component={InteractivityHubScreen}
      />
      <Stack.Screen
        name="GameSettings"
        component={GameSettingsScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="GoLive"
        component={GoLiveScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <Stack.Screen
        name="LiveView"
        component={LiveViewScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: true }}
      />
      <Stack.Screen
        name="FollowList"
        component={FollowListScreen}
      />
    </Stack.Navigator>
  );
}

const getStyles = (colors) => StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  tabIconFocused: {
    backgroundColor: colors.accentTint10,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 3,
  },
});

const styles = StyleSheet.create({
  bootLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
