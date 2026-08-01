import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import PhotoVerificationScreen from '../PhotoVerificationScreen';

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockDevAuthBypassEnabled = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('../../config/devAuth', () => ({
  devAuthBypassEnabled: () => mockDevAuthBypassEnabled(),
}));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  CameraType: { front: 'front' },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../config/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
    storage: { from: jest.fn() },
  },
}));

const COLORS = {
  surfaceMuted: '#F4F1EA',
  gray100: '#F7F7F7',
  gray300: '#DDD',
  gray400: '#AAA',
  gray500: '#777',
  separator: '#EEE',
  black: '#111',
  accent: '#0F8FD6',
  success: '#0F9D58',
};

const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  mockUseTheme.mockReturnValue({ colors: COLORS, isDark: false });
  mockUseAuth.mockReturnValue({
    user: { id: 'dev_1', isVerified: false },
    updateUser: jest.fn(),
  });
  mockDevAuthBypassEnabled.mockReturnValue(false);
});

describe('PhotoVerificationScreen', () => {
  it('normal Continue advances to the capture step', () => {
    const { getByText } = render(<PhotoVerificationScreen navigation={navigation} />);

    fireEvent.press(getByText('Continue'));

    expect(getByText('Capture Photo')).toBeTruthy();
  });

  it('dev Continue marks the local user verified and completes the flow', () => {
    const updateUser = jest.fn();
    mockDevAuthBypassEnabled.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      user: { id: 'dev_1', isVerified: false },
      updateUser,
    });
    const { getByText } = render(<PhotoVerificationScreen navigation={navigation} />);

    fireEvent.press(getByText('Continue'));

    expect(updateUser).toHaveBeenCalledWith({
      id: 'dev_1',
      isVerified: true,
      verified: true,
    });
    expect(getByText('Submitted!')).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
  });
});
