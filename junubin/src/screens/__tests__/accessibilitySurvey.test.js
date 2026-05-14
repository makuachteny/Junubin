import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AccessibilitySurveyScreen from '../AccessibilitySurveyScreen';

const mockUseTheme = jest.fn();
const mockSaveSurveyResponses = jest.fn(async () => {});

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => mockUseTheme(),
  };
});

jest.mock('../../accessibility', () => ({
  useAccessibilityPreferences: () => ({
    saveSurveyResponses: mockSaveSurveyResponses,
    prefs: {},
  }),
}));

jest.mock('../../auth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    ready: true,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('AccessibilitySurveyScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseTheme.mockReturnValue({
      colors: {
        accent: '#F56040',
        accentTint25: 'rgba(245,96,64,0.25)',
        gray300: '#DBDBDB',
        gray200: '#EFEFEF',
        gray500: '#8E8E8E',
        gray600: '#555555',
        black: '#111111',
        white: '#FFFFFF',
        surface: '#FFFFFF',
        separator: '#E7E7E7',
      },
    });
    mockSaveSurveyResponses.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves answers and resets to Main when no returnTo is given', async () => {
    // AccessibilitySurvey is the terminal step of onboarding — its default
    // exit goes back to the app shell, not to ProfileSetup. Resetting the
    // nav stack means Back from Home can't pop the user back here.
    const navigation = { replace: jest.fn(), reset: jest.fn(), goBack: jest.fn() };
    const { getByTestId, getAllByRole } = render(<AccessibilitySurveyScreen navigation={navigation} />);

    const toggles = getAllByRole('switch');
    fireEvent(toggles[0], 'valueChange', false);
    fireEvent(toggles[1], 'valueChange', false);

    await act(async () => {
      fireEvent.press(getByTestId('accessibility-save'));
    });

    expect(mockSaveSurveyResponses).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Main' }],
    });
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
