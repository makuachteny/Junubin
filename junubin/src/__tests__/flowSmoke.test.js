import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

import OnboardingScreen from '../screens/OnboardingScreen';
import SignupScreen from '../screens/SignupScreen';

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseCurrentUser = jest.fn();

jest.mock('../theme', () => {
  const actual = jest.requireActual('../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireAuth: () => (() => true),
}));

jest.mock('../payments', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => 'true'),
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

jest.mock('../utils/haptics', () => ({
  hapticSelection: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate }),
  };
});

const mockNavigate = jest.fn();
const mockStartOtp = jest.fn(async () => ({ message: 'OTP sent' }));
const mockLoginWithOtp = jest.fn(async () => ({ appUser: null }));

describe('Flow smoke tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      isDark: false,
      colors: {
        cream: '#F7F2EA',
        white: '#FFFFFF',
        black: '#111111',
        gray400: '#A0A0A0',
        gray500: '#888888',
        gray600: '#666666',
        gray200: '#DDDDDD',
        accent: '#0F8FD6',
        accentDark: '#085F91',
        rose: '#E84393',
        surfaceMuted: '#F1F1F1',
        separator: '#E7E7E7',
        gold: '#F0B41F',
        onGold: '#241B03',
        error: '#D94A4A',
      },
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isAuthenticated: false,
      session: null,
      user: null,
      startOtp: mockStartOtp,
      loginWithOtp: mockLoginWithOtp,
    });

    mockUseSubscription.mockReturnValue({
      tier: 'free',
      effectiveTier: 'free',
      adsEnabled: true,
      hasTier: () => false,
    });

    mockUseCurrentUser.mockReturnValue({
      currentUser: {
        name: 'Test User',
        images: ['https://example.com/a.jpg'],
        preferences: { location: 'Nairobi' },
      },
    });
  });

  it('welcome CONTINUE WITH PHONE navigates to Signup', () => {
    const navigation = { navigate: jest.fn() };
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    fireEvent.press(getByText('CONTINUE WITH PHONE'));
    expect(navigation.navigate).toHaveBeenCalledWith('Signup');
  });

  it('signup walks phone → code → verify with the in-app keypad', async () => {
    const navigation = {
      navigate: jest.fn(),
      replace: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => true,
    };
    const { getByText, getByPlaceholderText, getByRole, getByTestId, findByText } = render(
      <SignupScreen navigation={navigation} />
    );

    // Phone step — design copy
    expect(getByText("What's your number?")).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('912 345 678'), '912 345 678');
    fireEvent.press(getByRole('checkbox')); // accept ToS
    await act(async () => {
      fireEvent.press(getByText('SEND CODE'));
    });
    expect(mockStartOtp).toHaveBeenCalledWith({ phone: '+254912345678' });

    // OTP step — six digits on the keypad auto-verifies
    expect(await findByText('Enter the code')).toBeTruthy();
    for (const d of ['1', '2', '3', '4', '5', '6']) {
      await act(async () => {
        fireEvent.press(getByTestId(`keypad-${d}`));
      });
    }
    expect(mockLoginWithOtp).toHaveBeenCalledWith({
      phone: '+254912345678',
      code: '123456',
    });
    // No profile on the account → ProfileSetup
    expect(navigation.replace).toHaveBeenCalledWith('ProfileSetup');
  });

});
