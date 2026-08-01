import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import ProfileSetupScreen from '../ProfileSetupScreen';
import AppNavigator from '../../navigation/AppNavigator';
// PurposeScreen was merged into ProfileSetupScreen as a step

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseCurrentUser = jest.fn();
const mockSetItem = jest.fn(async () => {});
const mockGetItem = jest.fn(async () => null);

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../payments', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: (...args) => mockSetItem(...args),
  getItem: (...args) => mockGetItem(...args),
}));

jest.mock('../../accessibility', () => ({
  useAccessibilityPreferences: () => ({ prefs: {}, saveSurveyResponses: jest.fn() }),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('../../api/services/profileService', () => ({
  updateProfile: jest.fn(async (u) => u),
  uploadPhoto: jest.fn(async () => {}),
}));

jest.mock('../../utils/haptics', () => ({
  hapticSelection: jest.fn(),
  hapticHeavy: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...(() => {
    const React = require('react');
    const insets = { top: 0, bottom: 0, left: 0, right: 0 };
    const frame = { x: 0, y: 0, width: 390, height: 844 };
    const SafeAreaInsetsContext = React.createContext(insets);
    const SafeAreaFrameContext = React.createContext(frame);
    const SafeAreaProvider = ({ children }) => (
      <SafeAreaInsetsContext.Provider value={insets}>
        <SafeAreaFrameContext.Provider value={frame}>{children}</SafeAreaFrameContext.Provider>
      </SafeAreaInsetsContext.Provider>
    );
    return {
      SafeAreaInsetsContext,
      SafeAreaFrameContext,
      SafeAreaProvider,
      useSafeAreaInsets: () => insets,
      useSafeAreaFrame: () => frame,
    };
  })(),
}));

jest.mock('../HomeScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Home Screen</Text>;
});
jest.mock('../DirectoryScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Directory Screen</Text>;
});
jest.mock('../MessagesScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>Messages Screen</Text>;
});

const COLORS = {
  cream: '#F7F2EA', creamDark: '#EDE6DA', white: '#FFFFFF', black: '#111111',
  gray: '#666', gray100: '#F0F0F0', gray200: '#DDD', gray300: '#CCC',
  gray400: '#A0A0A0', gray500: '#888', gray600: '#666', gray700: '#444',
  gray900: '#1A1A1A',
  accent: '#CE1126', accentDark: '#A80E1F',
  accentTint04: '#FEF6F4', accentTint06: '#FEF3F0', accentTint08: '#FEF0EC',
  accentTint10: '#FDE7E1', accentTint12: '#FDDDD5', accentTint15: '#FDD4CA',
  accentTint25: '#FBC0B1',
  surface: '#FFF', separator: '#E7E7E7', cardBg: '#FFF', cardBorder: '#E0E0E0',
  inputBg: '#F8F8F8', inputBorder: '#E0E0E0',
  tabActive: '#111', tabInactive: '#9A9A9A',
  error: '#CE1126', success: '#009739', rose: '#E84393', gold: '#FCCD12',
};

describe('Onboarding / open-to flow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockUseTheme.mockReturnValue({ isDark: false, toggleTheme: jest.fn(), colors: COLORS });
    mockUseAuth.mockReturnValue({
      ready: true, isAuthenticated: true, session: { user: { id: '1' } },
      user: null, logout: jest.fn(), updateUser: jest.fn(),
    });
    mockUseSubscription.mockReturnValue({
      tier: 'free',
      effectiveTier: 'free',
      promoTier: null,
      promoEndsAt: null,
      adsEnabled: true,
      hasTier: () => false,
      consumeCoins: () => true,
      addCoins: jest.fn(),
      addSpotlights: jest.fn(),
      addSuperLikes: jest.fn(),
      addWhispers: jest.fn(),
      setAdsEnabled: jest.fn(),
      grantPromoTier: jest.fn(),
      restorePurchases: jest.fn(),
      cancelSubscription: jest.fn(),
      isSubscribed: () => false,
      purchaseInProgress: false,
      reset: jest.fn(),
    });
    mockUseCurrentUser.mockReturnValue({ currentUser: null });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the open-to step first on ProfileSetup', () => {
    // "What are you open to?" replaced the Dating/Socialize purpose
    // cards in the social pivot. It leads because it is what makes
    // someone findable by the right people.
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: {} };
    const { getByText } = render(<ProfileSetupScreen navigation={nav} route={route} />);
    expect(getByText('What are you open to?')).toBeTruthy();
  });

  it('open-to step shows the community badges', () => {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: {} };
    const { getByTestId } = render(
      <ProfileSetupScreen navigation={nav} route={route} />
    );
    expect(getByTestId('open-to-friendship')).toBeTruthy();
    expect(getByTestId('open-to-community')).toBeTruthy();
    expect(getByTestId('open-to-student')).toBeTruthy();
  });

  it('asks no dating questions anywhere in onboarding', () => {
    // Acceptance criterion for the pivot: a new user is never asked
    // about sexuality, who they want to date, dating intentions, or
    // children. These steps were deleted, not hidden behind a flag.
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: {} };
    const { queryByText } = render(
      <ProfileSetupScreen navigation={nav} route={route} />
    );
    expect(queryByText("What's your sexuality?")).toBeNull();
    expect(queryByText('Who do you want to date?')).toBeNull();
    expect(queryByText('Do you have children?')).toBeNull();
    expect(queryByText('What brings you here?')).toBeNull();
  });

  it('authenticated user with complete profile goes to Main (Chats is the home tab)', async () => {
    mockUseAuth.mockReturnValue({
      ready: true, isAuthenticated: true, session: { user: { id: '1' } },
      user: { profile: { profileComplete: true } },
      logout: jest.fn(), updateUser: jest.fn(),
    });

    const { findByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    expect(await findByText('Messages Screen')).toBeTruthy();
  });

  it('authenticated user with accountPurpose set goes to Main', async () => {
    mockUseAuth.mockReturnValue({
      ready: true, isAuthenticated: true, session: { user: { id: '1' } },
      user: { profile: { accountPurpose: 'socialize' } },
      logout: jest.fn(), updateUser: jest.fn(),
    });

    const { findByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    expect(await findByText('Messages Screen')).toBeTruthy();
  });

  it('authenticated user without profile goes to ProfileSetup', async () => {
    mockUseAuth.mockReturnValue({
      ready: true, isAuthenticated: true, session: { user: { id: '1' } },
      user: { profile: null },
      logout: jest.fn(), updateUser: jest.fn(),
    });

    const { findByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    // First step is the open-to badges, not the name field.
    expect(await findByText('What are you open to?')).toBeTruthy();
  });

  it('unauthenticated user sees Onboarding', async () => {
    mockUseAuth.mockReturnValue({
      ready: true, isAuthenticated: false, session: null, user: null,
      logout: jest.fn(), updateUser: jest.fn(),
    });

    const { findByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    // Onboarding landing now shows the Get Started CTA (Skip removed
     // when the multi-page flow collapsed to a single landing screen).
    expect(await findByText('GET STARTED')).toBeTruthy();
  });

  it('returning unauthenticated user skips landing and sees Signup', async () => {
    mockGetItem.mockResolvedValue('true');
    mockUseAuth.mockReturnValue({
      ready: true, isAuthenticated: false, session: null, user: null,
      logout: jest.fn(), updateUser: jest.fn(),
    });

    const { findByText, queryByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    expect(await findByText('JOIN THE COMMUNITY')).toBeTruthy();
    expect(queryByText('GET STARTED')).toBeNull();
  });
});
