import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OnboardingScreen from '../screens/OnboardingScreen';

// Mock safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

const mockNavigate = jest.fn();
const navigation = { navigate: mockNavigate, replace: jest.fn() };

// Industry redesign welcome screen: full-bleed photo + scrim, condensed
// wordmark, headline, Blueprint CTA. These tests lock the new surface.
describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the wordmark, headline and non-dating positioning', () => {
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    expect(getByText('JUNUBIN')).toBeTruthy();
    expect(getByText('Find your South Sudanese people.')).toBeTruthy();
    expect(getByText(/not a dating app/)).toBeTruthy();
  });

  it('GET STARTED navigates to the Signup screen', () => {
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    fireEvent.press(getByText('GET STARTED'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });

  it('links to terms and privacy', () => {
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    fireEvent.press(getByText('Terms'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsInfo', { pageKey: 'terms' });
    fireEvent.press(getByText('Privacy Policy'));
    expect(mockNavigate).toHaveBeenCalledWith('SettingsInfo', { pageKey: 'privacy' });
  });

  it('carries no dating-era copy or warm-gold palette', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('#F5B741');
    expect(tree).not.toContain('#E27D2C');
    expect(tree.toLowerCase()).not.toContain('match');
  });
});
