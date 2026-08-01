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

  it('renders the name step first on ProfileSetup (5-step Industry flow)', () => {
    // The redesign collapses onboarding to 5 grouped steps. Step 1 is
    // name + birthday ("What should we call you?").
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: {} };
    const { getByText } = render(<ProfileSetupScreen navigation={nav} route={route} />);
    expect(getByText('What should we call you?')).toBeTruthy();
    expect(getByText('STEP 1 OF 5')).toBeTruthy();
  });

  it('open-to step (step 2) shows the community chips', () => {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };
    // resumeAt seeks straight to the openTo step.
    const route = { params: { resumeAt: 'openTo' } };
    const { getByTestId, getByText } = render(
      <ProfileSetupScreen navigation={nav} route={route} />
    );
    expect(getByText('What are you open to?')).toBeTruthy();
    expect(getByTestId('open-to-friendship')).toBeTruthy();
    expect(getByTestId('open-to-community')).toBeTruthy();
    expect(getByTestId('open-to-student')).toBeTruthy();
  });

  it('maps stale eligibility resume ids onto the nearest surviving step', () => {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };

    // `country` is no longer asked — nearest step is city (step 3).
    let r = render(
      <ProfileSetupScreen navigation={nav} route={{ params: { resumeAt: 'country' } }} />
    );
    expect(r.getByText('Which city are you in?')).toBeTruthy();
    r.unmount();

    // `photos` maps to the final Photo & visibility step.
    r = render(
      <ProfileSetupScreen navigation={nav} route={{ params: { resumeAt: 'photos' } }} />
    );
    expect(r.getByText('Photo & visibility')).toBeTruthy();
    r.unmount();

    // Fields moved to EditProfile (interests / prompts) land on the
    // last step so the user can finish and polish later.
    r = render(
      <ProfileSetupScreen navigation={nav} route={{ params: { resumeAt: 'interests' } }} />
    );
    expect(r.getByText('Photo & visibility')).toBeTruthy();
    r.unmount();

    // Legacy dating-era ids land on openTo.
    r = render(
      <ProfileSetupScreen navigation={nav} route={{ params: { resumeAt: 'sexuality' } }} />
    );
    expect(r.getByText('What are you open to?')).toBeTruthy();
  });

  it('skips only on the city and background steps, and shows the visibility consent last', () => {
    const nav = { navigate: jest.fn(), goBack: jest.fn() };

    // Steps 1 and 2 are not skippable.
    let r = render(
      <ProfileSetupScreen navigation={nav} route={{ params: {} }} />
    );
    expect(r.queryByText('Skip')).toBeNull();
    r.unmount();

    // Step 3 (city) is skippable — Skip advances to background.
    r = render(
      <ProfileSetupScreen navigation={nav} route={{ params: { resumeAt: 'city' } }} />
    );
    fireEvent.press(r.getByText('Skip'));
    expect(r.getByText('Your background & languages')).toBeTruthy();
    expect(r.getByTestId('language-Juba Arabic')).toBeTruthy();
    // Step 4 is also skippable — Skip lands on Photo & visibility.
    fireEvent.press(r.getByText('Skip'));
    expect(r.getByText('Photo & visibility')).toBeTruthy();
    // Final step: no Skip, real locationVisibility radios, ENTER CTA.
    expect(r.queryByText('Skip')).toBeNull();
    expect(r.getByTestId('location-visibility-off')).toBeTruthy();
    expect(r.getByTestId('location-visibility-city')).toBeTruthy();
    expect(r.getByTestId('location-visibility-coarse')).toBeTruthy();
    expect(r.getByText('ENTER JUNUBIN')).toBeTruthy();
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
    // First step of the 5-step flow is name + birthday.
    expect(await findByText('What should we call you?')).toBeTruthy();
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
