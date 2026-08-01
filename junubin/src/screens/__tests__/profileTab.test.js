// ProfileScreen — the "Profile" tab (JuNubin Redesign).
//
// Covers the surfaces this screen owns: the header (kicker + gear),
// the identity block with its static follower strip, the PROFILE
// STRENGTH checklist (five design rows driven by the
// profileCompleteness util), the OPEN TO / LANGUAGES chips, and the
// Edit / Preview / theme-toggle actions.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ProfileScreen from '../ProfileScreen';

const mockUseTheme = jest.fn();
const mockUseCurrentUser = jest.fn();
const mockUseMyFollowCounts = jest.fn();
const mockToggleTheme = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

jest.mock('../../hooks/useFollow', () => ({
  useMyFollowCounts: (...args) => mockUseMyFollowCounts(...args),
}));

jest.mock('../../api/services/profileService', () => ({
  uploadPhoto: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: jest.fn() };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Values consistent with src/theme/palettes.js (light palette).
const COLORS = {
  cream: '#FDFCFA', black: '#252A30', white: '#FFF',
  gray300: '#CCC', gray400: '#A0A0A0', gray500: '#888', gray600: '#666',
  accent: '#0F8FD6', accentDark: '#085F91',
  accentTint08: 'rgba(15,143,214,0.08)', accentTint15: 'rgba(15,143,214,0.15)',
  surfaceMuted: '#F4F1EA', separator: '#E7E2D8', inputBg: '#F4F1EA',
  ssInk: '#14212E', ssRed: '#D94A4A', ssGreen: '#0F9D58',
  ssGold: '#F0B41F', ssBlue: '#0F8FD6',
  ssRedTint: '#FBE9E7', ssGreenTint: '#E3F4EA',
  ssGoldTint: '#FBF1D3', ssBlueTint: '#E2F2FB',
  ssRedDark: '#A33636', ssGreenDark: '#0C7A45',
  ssGoldDark: '#8F6A0A', ssBlueDark: '#085F91',
  onGold: '#241B03',
};

// One photo + languages filled; background, prompt and verification
// missing → strength = 2/5 = 40%.
const USER = {
  id: 'me-1',
  name: 'Akol',
  age: 27,
  city: 'Nairobi',
  verified: false,
  images: ['https://example.com/me.jpg'],
  openTo: ['friendship', 'community'],
  languages: ['Juba Arabic', 'English'],
};

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(() => false),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS, toggleTheme: mockToggleTheme });
  mockUseCurrentUser.mockReturnValue({ currentUser: USER, refreshUser: jest.fn() });
  mockUseMyFollowCounts.mockReturnValue({ followers: 128, following: 86 });
});

describe('ProfileScreen (Profile tab)', () => {
  it('renders the header, identity block, strength card, chips and actions', () => {
    const { getByText } = render(<ProfileScreen navigation={navigation} route={{ params: {} }} />);

    expect(getByText('JUNUBIN')).toBeTruthy();
    expect(getByText('Profile')).toBeTruthy();
    expect(getByText(/Akol/)).toBeTruthy();
    expect(getByText('PROFILE STRENGTH')).toBeTruthy();
    expect(getByText(/followers/)).toBeTruthy();
    expect(getByText(/following/)).toBeTruthy();
    expect(getByText('OPEN TO')).toBeTruthy();
    expect(getByText('LANGUAGES')).toBeTruthy();
    expect(getByText('Juba Arabic')).toBeTruthy();
    expect(getByText('Edit profile')).toBeTruthy();
    expect(getByText('Preview as others')).toBeTruthy();
  });

  it('shows the five design checklist rows and the matching percent', () => {
    const { getByText } = render(<ProfileScreen navigation={navigation} route={{ params: {} }} />);

    expect(getByText('Add a profile photo')).toBeTruthy();
    expect(getByText('Add your background')).toBeTruthy();
    expect(getByText('Add languages')).toBeTruthy();
    expect(getByText('Answer a profile prompt')).toBeTruthy();
    expect(getByText('Verify your photo')).toBeTruthy();
    // photos + languages done → 2/5.
    expect(getByText('40%')).toBeTruthy();
  });

  it('gear opens Settings; actions open EditProfile and the self-preview detail', () => {
    const { getByLabelText, getByText } = render(
      <ProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.press(getByLabelText('Settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');

    fireEvent.press(getByText('Edit profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');

    fireEvent.press(getByText('Preview as others'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ProfileDetail',
      expect.objectContaining({
        selfPreview: true,
        profile: expect.objectContaining({ id: 'me-1', userId: 'me-1' }),
      }),
    );
  });

  it('strength rows route to EditProfile and PhotoVerification', () => {
    const { getByText } = render(<ProfileScreen navigation={navigation} route={{ params: {} }} />);

    fireEvent.press(getByText('Add your background'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');

    fireEvent.press(getByText('Verify your photo'));
    expect(navigation.navigate).toHaveBeenCalledWith('PhotoVerification');
  });

  it('follower/following counts are static text, not navigation', () => {
    const { getByText } = render(<ProfileScreen navigation={navigation} route={{ params: {} }} />);

    fireEvent.press(getByText(/followers/));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('theme button reflects the current scheme and toggles it', () => {
    const { getByText, rerender } = render(
      <ProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.press(getByText('Switch to dark mode'));
    expect(mockToggleTheme).toHaveBeenCalled();

    mockUseTheme.mockReturnValue({ isDark: true, colors: COLORS, toggleTheme: mockToggleTheme });
    rerender(<ProfileScreen navigation={navigation} route={{ params: {} }} />);
    expect(getByText('Switch to light mode')).toBeTruthy();
  });
});
