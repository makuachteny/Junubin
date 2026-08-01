// ProfileScreen — the "Profile" tab (Industry redesign).
//
// Covers the surfaces this screen owns: the identity block, the
// PROFILE STRENGTH checklist (driven by the profileCompleteness util,
// so a tap must deep-link into the right EditProfile step), the
// OPEN TO / LANGUAGES chips, and the Edit / Preview actions.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ProfileScreen from '../ProfileScreen';

const mockUseTheme = jest.fn();
const mockUseCurrentUser = jest.fn();
const mockUseMyFollowCounts = jest.fn();

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

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: jest.fn() };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const COLORS = {
  cream: '#FFF', black: '#111', white: '#FFF',
  gray300: '#CCC', gray400: '#A0A0A0', gray500: '#888', gray600: '#666',
  accent: '#2E7FD0', accentDark: '#175A9E',
  accentTint08: 'rgba(46,127,208,0.08)', accentTint15: 'rgba(46,127,208,0.15)',
  surfaceMuted: '#EDF4FB', separator: '#E7E7E7',
};

const USER = {
  id: 'me-1',
  name: 'Akol',
  age: 27,
  city: 'Nairobi',
  country: 'Kenya',
  verified: false,
  images: ['https://example.com/me.jpg'],
  bio: 'Hello there',
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
  mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS });
  mockUseCurrentUser.mockReturnValue({ currentUser: USER, refreshUser: jest.fn() });
  mockUseMyFollowCounts.mockReturnValue({ followers: 128, following: 86 });
});

describe('ProfileScreen (Profile tab)', () => {
  it('renders the identity block, strength card, chips and actions', () => {
    const { getByText } = render(<ProfileScreen navigation={navigation} route={{ params: {} }} />);

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

  it('gear icon opens Settings; actions open EditProfile and ProfileView', () => {
    const { getByLabelText, getByText } = render(
      <ProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.press(getByLabelText('Settings'));
    expect(navigation.navigate).toHaveBeenCalledWith('Settings');

    fireEvent.press(getByText('Edit profile'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile');

    fireEvent.press(getByText('Preview as others'));
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ProfileView',
      expect.objectContaining({ profile: expect.objectContaining({ id: 'me-1' }) }),
    );
  });

  it('strength checklist rows deep-link into EditProfile with the right focusStep', () => {
    const { getByText } = render(<ProfileScreen navigation={navigation} route={{ params: {} }} />);

    // USER has < 3 photos, so this row is not done — tapping it must
    // land on the photos step from the completeness util.
    fireEvent.press(getByText('Add at least 3 photos'));
    expect(navigation.navigate).toHaveBeenCalledWith('EditProfile', { focusStep: 'photos' });
  });

  it('shows no back button when rendered as a tab', () => {
    const { queryByLabelText } = render(
      <ProfileScreen navigation={navigation} route={{ params: {} }} />
    );
    expect(queryByLabelText('Back')).toBeNull();
  });
});
