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

// Industry redesign Welcome screen (design.html): full-bleed photo +
// scrim, flag mark + wordmark, gold-accent headline, Blueprint gold
// CTA, flag stripe. These tests lock the new surface.
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

  it('shows the one-tap sign in caption', () => {
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    expect(getByText('One-tap sign in. No passwords, ever.')).toBeTruthy();
  });

  it('CONTINUE WITH PHONE navigates to the Signup screen', () => {
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    fireEvent.press(getByText('CONTINUE WITH PHONE'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });

  it('renders all five flag stripe bands', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    // Design's exact band hexes (black, red, gold, green, blue).
    ['#000000', '#D94A4A', '#F0B41F', '#0F9D58', '#0F8FD6'].forEach((hex) => {
      expect(tree).toContain(hex);
    });
  });

  it('carries no dating-era copy or warm-gold palette', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('#F5B741');
    expect(tree).not.toContain('#E27D2C');
    expect(tree.toLowerCase()).not.toContain('match');
  });
});
