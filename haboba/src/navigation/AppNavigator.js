import React, { useMemo, useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, ActivityIndicator, Animated, Dimensions } from 'react-native';
import { useTheme, FontFamily } from '../theme';
import { useAuth } from '../auth';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_COUNT = 3;

// Screens - Onboarding flow (eager — auth flow)
import OnboardingScreen from '../screens/OnboardingScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
// Screens - Tab bar (eager — initial render)
import HomeScreen from '../screens/HomeScreen';
import LikesScreen from '../screens/LikesScreen';
import MessagesScreen from '../screens/MessagesScreen';

// Lazy-loaded screens (behind navigation.navigate)
function lazify(importFn) {
  const LazyComponent = React.lazy(importFn);
  return function LazyScreen(props) {
    return (
      <React.Suspense fallback={<View style={styles.bootLoading}><ActivityIndicator size="large" color="#C4956A" /></View>}>
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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeTabs() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const likesPink = colors.accent;
  const tabIndicatorAnim = useRef(new Animated.Value(1)).current; // Start on HomeTab (index 1)
  const TAB_NAMES = ['LikesTab', 'HomeTab', 'MessagesTab'];

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
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
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
          let iconName;
          const activeColor = route.name === 'LikesTab' ? likesPink : colors.tabActive;
          const iconColor = focused ? activeColor : colors.tabInactive;

          // Discover gets a big raised center button
          if (route.name === 'HomeTab') {
            return (
              <View style={[styles.centerBtnWrap]}>
                <View style={[styles.centerBtn, { backgroundColor: focused ? colors.accent : colors.gray200 }]}>
                  <Ionicons
                    name={focused ? 'location' : 'location-outline'}
                    size={24}
                    color={focused ? '#FFF' : colors.gray500}
                  />
                </View>
              </View>
            );
          }

          switch (route.name) {
            case 'LikesTab':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'MessagesTab':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
          }

          return (
            <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
              <Ionicons name={iconName} size={26} color={iconColor} />
              {focused && <View style={[styles.activeDot, { backgroundColor: activeColor }]} />}
            </View>
          );
        },
      })}
      screenListeners={({ route }) => ({
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
      <Tab.Screen name="LikesTab" component={LikesScreen} options={{ tabBarLabel: 'Likes' }} />
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Discover',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3, marginTop: 6 },
        }}
      />
      <Tab.Screen name="MessagesTab" component={MessagesScreen} options={{ tabBarLabel: 'Chat' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const { isAuthenticated, ready, user } = useAuth();
  const profileComplete = user?.profile?.profileComplete ?? true;

  if (!ready) {
    return (
      <View style={[styles.bootLoading, { backgroundColor: colors.cream }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? (profileComplete ? 'Main' : 'ProfileSetup') : 'Onboarding'}
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
  centerBtnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  centerBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: colors.surface,
  },
});

const styles = StyleSheet.create({
  bootLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
