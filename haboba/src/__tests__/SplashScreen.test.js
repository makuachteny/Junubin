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

  it('displays the tagline text', () => {
    const { toJSON } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('Connect with your people');
  });

  it('exposes the greeting test id', () => {
    const { getByTestId } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    expect(getByTestId('splash-greeting')).toBeTruthy();
  });

  it('renders the logo and tagline', () => {
    const { getByTestId } = render(
      <SplashScreen onFinish={jest.fn()} authReady={false} />
    );
    expect(getByTestId('splash-tagline')).toBeTruthy();
  });

  it('calls onFinish after animation completes when authReady', () => {
    const onFinish = jest.fn();
    render(
      <SplashScreen onFinish={onFinish} authReady={true} />
    );

    // Advance past minimum display time (2500ms)
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
});
