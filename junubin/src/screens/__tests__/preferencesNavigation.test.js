import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import PreferencesScreen from '../PreferencesScreen';

const mockUseTheme = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseAuth = jest.fn();
const mockUseCurrentUser = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => mockUseTheme(),
  };
});

jest.mock('../../payments', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

jest.mock('../../api/services/profileService', () => ({
  updateProfile: jest.fn(async () => ({})),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
}));

describe('PreferencesScreen navigation', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      isDark: false,
      colors: {
        cream: '#F7F2EA',
        white: '#FFFFFF',
        black: '#111111',
        gray200: '#DDDDDD',
        gray300: '#CFCFCF',
        gray400: '#A0A0A0',
        gray500: '#8E8E8E',
        gray600: '#666666',
        gray700: '#444444',
        accent: '#CE1126',
        accentTint10: '#FDE7E1',
        gold: '#F9A825',
        surface: '#FFFFFF',
        separator: '#E7E7E7',
      },
    });

    mockUseSubscription.mockReturnValue({
      hasTier: () => false,
      effectiveTier: 'free',
      promoTier: null,
      promoEndsAt: null,
      adsEnabled: true,
      addCoins: jest.fn(),
      addSpotlights: jest.fn(),
      addSuperLikes: jest.fn(),
      addWhispers: jest.fn(),
      setAdsEnabled: jest.fn(),
      grantPromoTier: jest.fn(),
    });

    mockUseAuth.mockReturnValue({ session: null });
    mockUseCurrentUser.mockReturnValue({ refreshUser: jest.fn() });
  });

  const makeNav = () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  });

  it('routes to the Connect tab when returnTo=Discover and Done is pressed', async () => {
    const navigation = makeNav();
    const route = { params: { returnTo: 'Discover' } };

    const { getByText } = render(
      <PreferencesScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByText('Done'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('Main', { screen: 'HomeTab' });
    });
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('routes to the Directory tab when returnTo=Directory and Done is pressed', async () => {
    const navigation = makeNav();
    const route = { params: { returnTo: 'Directory' } };

    const { getByText } = render(
      <PreferencesScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByText('Done'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('Main', { screen: 'DirectoryTab' });
    });
  });

  it('maps a stale returnTo=Likes onto a tab that still exists', async () => {
    // The Likes tab is gone. A deep link or an older build can still
    // send `returnTo: 'Likes'`, and that must not navigate to an
    // unregistered route — it lands on the inbox instead.
    const navigation = makeNav();
    const route = { params: { returnTo: 'Likes' } };

    const { getByText } = render(
      <PreferencesScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByText('Done'));

    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith('Main', { screen: 'MessagesTab' });
    });
  });

  it('falls back to goBack when no returnTo is provided', async () => {
    const navigation = makeNav();
    const route = { params: {} };

    const { getByText } = render(
      <PreferencesScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByText('Done'));

    await waitFor(() => {
      expect(navigation.goBack).toHaveBeenCalled();
    });
  });
});
