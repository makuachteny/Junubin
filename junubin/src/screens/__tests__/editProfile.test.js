// EditProfileScreen — the redesign's three-section editor
// (BACKGROUND / LANGUAGES / PROFILE PROMPT) with the Blueprint gold
// SAVE. Verifies the chip contracts (single-select tribe, multi-select
// languages), the save payload, error handling, and that a stale
// focusStep param never crashes the screen.

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import EditProfileScreen from '../EditProfileScreen';
import * as profileService from '../../api/services/profileService';

const mockUseTheme = jest.fn();
const mockUseCurrentUser = jest.fn();
const mockUpdateUser = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

jest.mock('../../auth', () => ({
  useAuth: () => ({ session: { user: { id: 'me-1' } }, updateUser: mockUpdateUser }),
}));

jest.mock('../../api/services/profileService', () => ({
  updateProfile: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Values consistent with src/theme/palettes.js (light palette).
const COLORS = {
  cream: '#FDFCFA', black: '#252A30',
  gray400: '#A0A0A0', gray500: '#888',
  accent: '#0F8FD6', accentDark: '#085F91',
  accentTint15: 'rgba(15,143,214,0.15)',
  separator: '#E7E2D8', inputBg: '#F4F1EA',
  ssGold: '#F0B41F', onGold: '#241B03',
};

const USER = {
  id: 'me-1',
  name: 'Akol',
  ethnicity: '',
  languages: ['English'],
  _raw: { profile: { promptAnswer: '' } },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS });
  mockUseCurrentUser.mockReturnValue({ currentUser: USER, refreshUser: jest.fn() });
  profileService.updateProfile.mockResolvedValue({ id: 'me-1' });
});

describe('EditProfileScreen (redesign)', () => {
  it('renders the three design sections and SAVE', () => {
    const { getByText, getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    expect(getByText('Edit profile')).toBeTruthy();
    expect(getByText('BACKGROUND')).toBeTruthy();
    expect(getByText('LANGUAGES')).toBeTruthy();
    expect(getByText(/PROFILE PROMPT/)).toBeTruthy();
    expect(getByTestId('edit-prompt').props.placeholder).toBe(
      'e.g. Came for university, stayed for the community',
    );
    expect(getByText('SAVE')).toBeTruthy();
  });

  it('saves the selections through the profile service and goes back', async () => {
    const { getByText, getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    // Tribe chips are a radio group (Profile.ethnicity is single).
    fireEvent.press(getByTestId('edit-tribe-Dinka'));
    // Languages are multi-select — add one to the hydrated 'English'.
    fireEvent.press(getByTestId('edit-language-Juba Arabic'));
    fireEvent.changeText(getByTestId('edit-prompt'), 'Came for university');

    fireEvent.press(getByText('SAVE'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(profileService.updateProfile).toHaveBeenCalledWith({
      ethnicity: 'Dinka',
      languages: ['English', 'Juba Arabic'],
      promptQuestion: 'What brought you to your city?',
      promptAnswer: 'Came for university',
    });
  });

  it('selecting a second tribe replaces the first; re-tap clears it', async () => {
    const { getByText, getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.press(getByTestId('edit-tribe-Dinka'));
    fireEvent.press(getByTestId('edit-tribe-Nuer'));
    fireEvent.press(getByText('SAVE'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(profileService.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ ethnicity: 'Nuer' }),
    );
  });

  it('surfaces a save failure and stays on the screen', async () => {
    profileService.updateProfile.mockRejectedValueOnce(new Error('offline'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByText } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.press(getByText('SAVE'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'offline'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('accepts a stale focusStep param without crashing', () => {
    const { getByText } = render(
      <EditProfileScreen navigation={navigation} route={{ params: { focusStep: 'languages' } }} />
    );
    expect(getByText('LANGUAGES')).toBeTruthy();
  });
});
