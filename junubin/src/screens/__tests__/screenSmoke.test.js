import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { render, act } from '@testing-library/react-native';

import OnboardingScreen from '../OnboardingScreen';
import ChatScreen from '../ChatScreen';
import SettingsScreen from '../SettingsScreen';
import AppNavigator from '../../navigation/AppNavigator';

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseCurrentUser = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => mockUseTheme(),
  };
});

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireAuth: () => (() => true),
}));

jest.mock('../../payments', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

// ChatScreen now uses useFocusEffect to mark the conversation read on
// focus. The smoke test renders ChatScreen without a NavigationContainer
// (the AppNavigator suite uses one), so stub useFocusEffect to a no-op
// here while preserving everything else from the real module.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: jest.fn() };
});

jest.mock('../../api/hooks/useRealtime', () => ({
  useRealtime: () => ({
    onMessage: () => () => {},
    onTypingStart: () => () => {},
    onTypingStop: () => () => {},
    onReadReceipt: () => () => {},
    emitTypingStart: jest.fn(),
    emitTypingStop: jest.fn(),
    emitReadReceipt: jest.fn(),
    joinConversation: jest.fn(),
    leaveConversation: jest.fn(),
  }),
}));

jest.mock('../../api/services/chatService', () => ({
  getMessages: jest.fn(async () => []),
  sendMessage: jest.fn(async () => ({ id: 'sent-1' })),
  markConversationRead: jest.fn(async () => 0),
}));

jest.mock('../../utils/useScreenshotProtection', () => ({
  useScreenshotProtection: jest.fn(),
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
  const React = require('react');
  const { Text } = require('react-native');
  return <Text>Home Screen</Text>;
});
jest.mock('../DirectoryScreen', () => () => {
  const React = require('react');
  const { Text } = require('react-native');
  return <Text>Directory Screen</Text>;
});
jest.mock('../MessagesScreen', () => () => {
  const React = require('react');
  const { Text } = require('react-native');
  return <Text>Messages Screen</Text>;
});

describe('screen smoke tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseTheme.mockReturnValue({
      isDark: false,
      toggleTheme: jest.fn(),
      colors: {
        cream: '#F7F2EA',
        white: '#FFFFFF',
        black: '#111111',
        gray: '#666666',
        gray200: '#DDDDDD',
        gray300: '#CFCFCF',
        gray400: '#A0A0A0',
        gray600: '#666666',
        accent: '#F56040',
        accentDark: '#B84730',
        accentTint08: '#FDEDE8',
        accentTint10: '#FDE7E1',
        accentTint15: '#FCE0D8',
        tabActive: '#111111',
        tabInactive: '#9A9A9A',
        surface: '#FFFFFF',
        separator: '#E7E7E7',
        cardBg: '#FFFFFF',
        error: '#C95D4F',
        success: '#22C55E',
      },
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isAuthenticated: true,
      session: null,
      user: { profile: { profileComplete: true } },
      logout: jest.fn(async () => {}),
    });

    mockUseSubscription.mockReturnValue({
      tier: 'free',
      effectiveTier: 'free',
      promoTier: null,
      promoEndsAt: null,
      spotlights: 0,
      superLikes: 0,
      coins: 100,
      adsEnabled: true,
      hasTier: () => false,
      consumeCoins: () => true,
      addCoins: jest.fn(),
      addSpotlights: jest.fn(),
      addSuperLikes: jest.fn(),
      addWhispers: jest.fn(),
      setAdsEnabled: jest.fn(),
      grantPromoTier: jest.fn(),
      restorePurchases: jest.fn(async () => ({ success: true })),
      cancelSubscription: jest.fn(),
      isSubscribed: () => false,
      purchaseInProgress: false,
      reset: jest.fn(async () => {}),
    });

    mockUseCurrentUser.mockReturnValue({
      currentUser: {
        preferences: {
          mode: 'Dating',
          showMe: true,
          lookingFor: 'Women',
          ageRange: [21, 30],
          distance: 50,
        },
      },
    });
  });

  afterEach(async () => {
    // Drain pending timers inside act so timer-driven state updates
    // (e.g. ChatScreen's deferred list scroll) don't warn.
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders Onboarding screen', () => {
    const navigation = { navigate: jest.fn(), replace: jest.fn() };
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    expect(getByText('CONTINUE WITH PHONE')).toBeTruthy();
    // The headline splits "South Sudanese" into a gold <Text> child, so
    // match the surrounding fragments rather than the whole sentence.
    expect(getByText('South Sudanese')).toBeTruthy();
  });

  it('renders Chat screen', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = {
      params: {
        match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] },
      },
    };
    const { getByText, getByPlaceholderText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );
    expect(getByText('Asha')).toBeTruthy();
    expect(getByPlaceholderText('Message…')).toBeTruthy();
    // ChatScreen kicks off getMessages()/markConversationRead() on mount;
    // flush those promises inside act so their state updates don't warn.
    await act(async () => {});
  });

  it('renders Settings screen', () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() };
    const { getByText } = render(<SettingsScreen navigation={navigation} />);
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('LOCATION VISIBILITY')).toBeTruthy();
    expect(getByText('APPEARANCE')).toBeTruthy();
    expect(getByText('ACCOUNT & SAFETY')).toBeTruthy();
  });

  it('renders Main app navigator for authenticated users', async () => {
    const { findByText } = render(
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    );
    // Chats (MessagesTab) is the initial tab — the retention loop is
    // conversations, so the app opens on them.
    expect(await findByText('Messages Screen')).toBeTruthy();
  });
});
