import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useTheme, FontFamily } from '../theme';
import { useAuth } from '../auth';

// Screens - Onboarding flow
import OnboardingScreen from '../screens/OnboardingScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
// Screens - Main app
import HomeScreen from '../screens/HomeScreen';
import LikesScreen from '../screens/LikesScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileDetailScreen from '../screens/ProfileDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PreferencesScreen from '../screens/PreferencesScreen';
import BoostScreen from '../screens/BoostScreen';
import EliteScreen from '../screens/EliteScreen';
// New screens
import ChatScreen from '../screens/ChatScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsInfoScreen from '../screens/SettingsInfoScreen';
import PreferenceSelectScreen from '../screens/PreferenceSelectScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function HomeTabs() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const likesPink = colors.accent;

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
          backgroundColor: colors.white,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 92 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          shadowColor: '#000',
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
                    size={21}
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
              <Ionicons name={iconName} size={22} color={iconColor} />
              {focused && <View style={[styles.activeDot, { backgroundColor: activeColor }]} />}
            </View>
          );
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
      />
    </Stack.Navigator>
  );
}

const getStyles = (colors) => StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  tabIconFocused: {
    backgroundColor: 'rgba(229, 107, 140, 0.1)',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
});

const styles = StyleSheet.create({
  bootLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
