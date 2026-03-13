import React from 'react';
import { render, act } from '@testing-library/react-native';
import SplashScreen from '../screens/SplashScreen';

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

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

describe('SplashScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('displays the cultural greeting text', () => {
    const { getByTestId } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    expect(getByTestId('splash-greeting')).toBeTruthy();
  });

  it('displays the tagline about South Sudanese hearts', () => {
    const { getByTestId } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    const tagline = getByTestId('splash-tagline');
    expect(tagline).toBeTruthy();
  });

  it('renders the South Sudan flag stripe with 5 bands', () => {
    const { toJSON } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    const tree = JSON.stringify(toJSON());
    // Flag colors should be present
    expect(tree).toContain('#0A0A0A'); // black
    expect(tree).toContain('#EF4444'); // red
    expect(tree).toContain('#F5F5F5'); // white
    expect(tree).toContain('#22C55E'); // green
    expect(tree).toContain('#3B82F6'); // blue
  });

  it('renders beadwork pattern elements', () => {
    const { toJSON } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    const tree = JSON.stringify(toJSON());
    // Gold accent from beadwork
    expect(tree).toContain('#FCAF45');
  });

  it('calls onFinish after animation completes when authReady', () => {
    const onFinish = jest.fn();
    render(
      <SplashScreen onFinish={onFinish} authReady={true} />
    );

    // Advance past minimum display time (2800ms)
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Advance past the fade out animation (400ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onFinish).toHaveBeenCalled();
  });

  it('does not call onFinish before minimum display time', () => {
    const onFinish = jest.fn();
    render(
      <SplashScreen onFinish={onFinish} authReady={true} />
    );

    // Before minimum time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onFinish).not.toHaveBeenCalled();
  });

  it('does not call onFinish when authReady is false', () => {
    const onFinish = jest.fn();
    render(
      <SplashScreen onFinish={onFinish} authReady={false} />
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(onFinish).not.toHaveBeenCalled();
  });

  it('renders the gold star accent from the South Sudan flag', () => {
    const { toJSON } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('★');
  });
});
