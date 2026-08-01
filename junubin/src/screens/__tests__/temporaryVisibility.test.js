import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';
import * as profileService from '../../api/services/profileService';

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

jest.mock('../../payments', () => {
  const actual = jest.requireActual('../../payments');
  return {
    ...actual,
    useSubscription: () => mockUseSubscription(),
  };
});

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

const THEME = {
  isDark: false,
  toggleTheme: jest.fn(),
  colors: {
    cream: '#F7F2EA',
    white: '#FFFFFF',
    black: '#111111',
    gray: '#666666',
    gray100: '#F2F2F2',
    gray200: '#DDDDDD',
    gray300: '#CFCFCF',
    gray400: '#A0A0A0',
    gray600: '#666666',
    accent: '#F56040',
    accentDark: '#B84730',
    accentTint08: '#FDEDE8',
    accentTint10: '#FDE7E1',
    accentTint15: '#FCE0D8',
    surface: '#FFFFFF',
    separator: '#E7E7E7',
    cardBg: '#FFFFFF',
    error: '#C95D4F',
    success: '#22C55E',
  },
};

const SUBSCRIPTION = {
  tier: 'free',
  effectiveTier: 'free',
  promoTier: null,
  promoEndsAt: null,
  hasTier: () => true,
  restorePurchases: jest.fn(async () => ({ success: true })),
  isSubscribed: () => false,
  reset: jest.fn(async () => {}),
};

const renderSettings = (profile = {}) => {
  mockUseCurrentUser.mockReturnValue({
    currentUser: {
      city: 'Omaha',
      preferences: { showMe: true, distance: 50 },
      profile,
    },
  });
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() };
  return render(<SettingsScreen navigation={navigation} />);
};

describe('Temporary location visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue(THEME);
    mockUseSubscription.mockReturnValue(SUBSCRIPTION);
    mockUseAuth.mockReturnValue({
      ready: true,
      isAuthenticated: true,
      session: { user: { id: 'auth-1' } },
      user: { profile: { profileComplete: true } },
      logout: jest.fn(async () => {}),
    });
  });

  it('hides the duration chips while visibility is off', async () => {
    const { queryByTestId } = renderSettings({ locationVisibility: 'off' });
    await act(async () => {});
    expect(queryByTestId('visible-for-1')).toBeNull();
    expect(queryByTestId('visible-for-unlimited')).toBeNull();
  });

  it('offers 1 hour / 8 hours / until turned off when visible, defaulting to no limit', async () => {
    const { getByTestId } = renderSettings({ locationVisibility: 'coarse' });
    await act(async () => {});
    expect(getByTestId('visible-for-1')).toBeTruthy();
    expect(getByTestId('visible-for-8')).toBeTruthy();
    expect(getByTestId('visible-for-unlimited')).toBeTruthy();
  });

  it('writes a future locationVisibleUntil when a timed window is picked', async () => {
    const { getByTestId, getByText } = renderSettings({ locationVisibility: 'coarse' });
    await act(async () => {});

    const before = Date.now();
    await act(async () => {
      fireEvent.press(getByTestId('visible-for-1'));
    });

    expect(profileService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ locationVisibleUntil: expect.any(String) }),
    );
    const written = profileService.updateProfile.mock.calls
      .map(([arg]) => arg.locationVisibleUntil)
      .filter(Boolean)
      .pop();
    const until = new Date(written).getTime();
    // ~1 hour out, allowing test-run slack.
    expect(until).toBeGreaterThan(before + 55 * 60_000);
    expect(until).toBeLessThan(before + 65 * 60_000);
    expect(getByText(/Visible until/)).toBeTruthy();
  });

  it('clears the window when "Until I turn it off" is picked', async () => {
    const { getByTestId } = renderSettings({ locationVisibility: 'coarse' });
    await act(async () => {});

    await act(async () => {
      fireEvent.press(getByTestId('visible-for-1'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('visible-for-unlimited'));
    });

    expect(profileService.updateProfile).toHaveBeenLastCalledWith({ locationVisibleUntil: null });
  });

  it('changing visibility level resets the window to no-limit', async () => {
    const { getByTestId } = renderSettings({ locationVisibility: 'coarse' });
    await act(async () => {});

    await act(async () => {
      fireEvent.press(getByTestId('location-visibility-city'));
    });

    expect(profileService.updateProfile).toHaveBeenCalledWith({
      locationVisibility: 'city',
      locationVisibleUntil: null,
    });
  });

  // An expired window means the server already hides this user; the
  // screen must reconcile to Hidden rather than showing a visibility
  // level nobody can see.
  it('reconciles an expired window back to Hidden on load', async () => {
    renderSettings({
      locationVisibility: 'coarse',
      locationVisibleUntil: new Date(Date.now() - 60_000).toISOString(),
    });
    await act(async () => {});

    expect(profileService.updateProfile).toHaveBeenCalledWith({
      locationVisibility: 'off',
      locationVisibleUntil: null,
    });
  });
});
