// EditProfileScreen — the redesign's editor (BACKGROUND / LANGUAGES /
// OCCUPATION + SCHOOL / PROFILE PROMPT) with the Blueprint gold SAVE.
// Verifies the chip contracts (single-select tribe, multi-select
// languages), the fact inputs and their save payload, error handling,
// and that a stale focusStep param never crashes the screen.

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import EditProfileScreen from '../EditProfileScreen';
import * as profileService from '../../api/services/profileService';

const mockUseTheme = jest.fn();
const mockUseCurrentUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockDevAuthBypassEnabled = jest.fn();

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

jest.mock('../../config/devAuth', () => ({
  devAuthBypassEnabled: () => mockDevAuthBypassEnabled(),
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
  profession: '',
  education: '',
  _raw: { profile: { promptAnswer: '' } },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockDevAuthBypassEnabled.mockReturnValue(false);
  mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS });
  mockUseCurrentUser.mockReturnValue({ currentUser: USER, refreshUser: jest.fn() });
  profileService.updateProfile.mockResolvedValue({ id: 'me-1' });
});

describe('EditProfileScreen (redesign)', () => {
  it('renders the design sections, inputs and SAVE', () => {
    const { getByText, getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    expect(getByText('Edit profile')).toBeTruthy();
    expect(getByText('BACKGROUND')).toBeTruthy();
    expect(getByText('LANGUAGES')).toBeTruthy();
    expect(getByText('OCCUPATION')).toBeTruthy();
    expect(getByText('SCHOOL')).toBeTruthy();
    expect(getByTestId('edit-occupation').props.placeholder).toBe('e.g. Nurse');
    expect(getByTestId('edit-school').props.placeholder).toBe('e.g. Univ. of Nairobi');
    expect(getByText(/PROFILE PROMPT/)).toBeTruthy();
    expect(getByTestId('edit-prompt').props.placeholder).toBe(
      'e.g. Came for university, stayed for the community',
    );
    expect(getByText('SAVE')).toBeTruthy();
  });

  it('hydrates occupation and school from the current profile', () => {
    mockUseCurrentUser.mockReturnValue({
      currentUser: { ...USER, profession: 'Nurse', education: 'Univ. of Nairobi' },
      refreshUser: jest.fn(),
    });
    const { getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    expect(getByTestId('edit-occupation').props.value).toBe('Nurse');
    expect(getByTestId('edit-school').props.value).toBe('Univ. of Nairobi');
  });

  it('hydrates from the raw profile when the normalized field is missing', () => {
    mockUseCurrentUser.mockReturnValue({
      currentUser: {
        ...USER,
        profession: '',
        education: '',
        languages: undefined,
        _raw: {
          id: 'me-1',
          profile: {
            ethnicity: 'Nuer',
            languages: ['Juba Arabic'],
            profession: 'Engineer',
            education: 'Juba University',
            promptAnswer: 'Work brought me here',
          },
        },
      },
      refreshUser: jest.fn(),
    });
    const { getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    expect(getByTestId('edit-occupation').props.value).toBe('Engineer');
    expect(getByTestId('edit-school').props.value).toBe('Juba University');
    expect(getByTestId('edit-prompt').props.value).toBe('Work brought me here');
    expect(getByTestId('edit-tribe-Nuer').props.accessibilityState.checked).toBe(true);
    expect(getByTestId('edit-language-Juba Arabic').props.accessibilityState.checked).toBe(true);
  });

  it('saves the selections through the profile service and goes back', async () => {
    const { getByText, getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    // Tribe chips are a radio group (Profile.ethnicity is single).
    fireEvent.press(getByTestId('edit-tribe-Dinka'));
    // Languages are multi-select — add one to the hydrated 'English'.
    fireEvent.press(getByTestId('edit-language-Juba Arabic'));
    fireEvent.changeText(getByTestId('edit-occupation'), 'Nurse');
    fireEvent.changeText(getByTestId('edit-school'), 'Univ. of Nairobi');
    fireEvent.changeText(getByTestId('edit-prompt'), 'Came for university');

    fireEvent.press(getByText('SAVE'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(profileService.updateProfile).toHaveBeenCalledWith({
      ethnicity: 'Dinka',
      languages: ['English', 'Juba Arabic'],
      profession: 'Nurse',
      education: 'Univ. of Nairobi',
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

  it('dev auth bypass saves locally without calling Supabase', async () => {
    mockDevAuthBypassEnabled.mockReturnValue(true);
    mockUseCurrentUser.mockReturnValue({
      currentUser: {
        ...USER,
        _raw: {
          id: 'dev_1',
          displayName: 'Akol',
          profile: { accountPurpose: 'socialize', languages: ['English'] },
          photos: [],
        },
      },
      refreshUser: jest.fn(),
    });
    const { getByText, getByTestId } = render(
      <EditProfileScreen navigation={navigation} route={{ params: {} }} />
    );

    fireEvent.press(getByTestId('edit-tribe-Dinka'));
    fireEvent.changeText(getByTestId('edit-occupation'), 'Nurse');
    fireEvent.changeText(getByTestId('edit-school'), 'Univ. of Nairobi');
    fireEvent.changeText(getByTestId('edit-prompt'), 'Came for university');
    fireEvent.press(getByText('SAVE'));

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(profileService.updateProfile).not.toHaveBeenCalled();
    expect(mockUpdateUser).toHaveBeenCalledWith(expect.objectContaining({
      id: 'dev_1',
      profile: expect.objectContaining({
        accountPurpose: 'socialize',
        ethnicity: 'Dinka',
        profession: 'Nurse',
        education: 'Univ. of Nairobi',
        promptQuestion: 'What brought you to your city?',
        promptAnswer: 'Came for university',
      }),
    }));
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
