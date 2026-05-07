import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OnboardingScreen from '../screens/OnboardingScreen';

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  const Svg = (props) => React.createElement(View, props);
  const Path = (props) => React.createElement(View, props);
  const G = (props) => React.createElement(View, props);
  const Circle = (props) => React.createElement(View, props);
  const SvgText = (props) => React.createElement(Text, props);
  const Defs = (props) => React.createElement(View, props);
  const Stop = (props) => React.createElement(View, props);
  const LinearGradient = (props) => React.createElement(View, props);
  const Rect = (props) => React.createElement(View, props);
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path,
    G,
    Circle,
    Rect,
    Text: SvgText,
    Defs,
    Stop,
    LinearGradient,
  };
});

// Mock safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

// Mock theme
jest.mock('../theme', () => ({
  FontFamily: {
    regular: 'DMSans-Regular',
    medium: 'DMSans-Medium',
    semibold: 'DMSans-SemiBold',
    bold: 'DMSans-Bold',
    extrabold: 'DMSans-ExtraBold',
    black: 'DMSans-Black',
    italic: 'DMSans-Italic',
    script: 'DancingScript-Bold',
  },
  Colors: {
    accent: '#CE1126',
    accentDark: '#A80E1F',
    cream: '#FFFFFF',
  },
  useTheme: () => ({
    colors: {
      accent: '#CE1126',
      accentDark: '#A80E1F',
      cream: '#FFFFFF',
    },
    isDark: false,
  }),
}));

// Mock accessibility
jest.mock('../accessibility', () => ({
  useAccessibilityPreferences: () => ({
    prefs: { reducedMotion: false },
  }),
}));

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const navigation = {
  navigate: mockNavigate,
  replace: mockReplace,
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows the diaspora invitation copy', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('EVERYWHERE');
    expect(tree).toContain("Doesn't matter where you are");
    expect(tree).toContain('home');
  });

  it('Get Started navigates to the Signup screen', () => {
    const { getByText } = render(<OnboardingScreen navigation={navigation} />);
    fireEvent.press(getByText('Get Started'));
    expect(mockNavigate).toHaveBeenCalledWith('Signup');
  });

  it('renders warm accent colors (honey gold / burnt orange)', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    // Warm landing palette — matches SignupScreen for visual continuity
    expect(tree).toContain('#F5B741'); // WARM.primary (honey gold)
    expect(tree).toContain('#E27D2C'); // WARM.mid (burnt orange)
  });

  it('renders the arrow-forward icon for navigation', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('arrow-forward');
  });

  it('renders the "home" accent text', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('home');
  });
});
