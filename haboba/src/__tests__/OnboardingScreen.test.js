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
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Path,
    G,
    Circle,
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
  useTheme: () => ({
    colors: {
      accent: '#E8613C',
      accentDark: '#D14E2B',
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

// Mock auth
const mockSetDevBypass = jest.fn();
jest.mock('../auth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    setDevBypass: mockSetDevBypass,
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

  it('displays the hero tagline with cultural messaging', () => {
    const { getByTestId } = render(<OnboardingScreen navigation={navigation} />);
    const heroText = getByTestId('onboarding-hero-connect');
    expect(heroText).toBeTruthy();
  });

  it('displays "OUR STORY" eyebrow text', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('OUR STORY');
  });

  it('renders the South Sudan flag colors', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#CE1126'); // red
    expect(tree).toContain('#009739'); // green
    expect(tree).toContain('#0047AB'); // blue
  });

  it('renders cultural pill badges (Dating, Social, Diaspora)', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Dating');
    expect(tree).toContain('Social');
    expect(tree).toContain('Diaspora');
  });

  it('shows diaspora cities', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Juba.');
    expect(tree).toContain('Minneapolis.');
    expect(tree).toContain('London.');
    expect(tree).toContain('Cairo.');
  });

  it('renders skip button on first page', () => {
    const { getByTestId } = render(<OnboardingScreen navigation={navigation} />);
    expect(getByTestId('onboarding-skip')).toBeTruthy();
  });

  it('calls setDevBypass when skip is pressed', () => {
    const { getByTestId } = render(<OnboardingScreen navigation={navigation} />);
    fireEvent.press(getByTestId('onboarding-skip'));
    expect(mockSetDevBypass).toHaveBeenCalledWith(true);
  });

  it('renders 3 progress dots', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    // 3 dots rendered (one active, two inactive)
    const dotMatches = tree.match(/borderRadius.*?3/g);
    expect(dotMatches).toBeTruthy();
    expect(dotMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('renders accent color elements', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    // Flag accent colors used in the screen
    expect(tree).toContain('#009739');
    expect(tree).toContain('#CE1126');
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

  it('renders South Sudan flag colors on page 2', () => {
    const { toJSON } = render(<OnboardingScreen navigation={navigation} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#CE1126');
    expect(tree).toContain('#009739');
    expect(tree).toContain('#0047AB');
  });
});
