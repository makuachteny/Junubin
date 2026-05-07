import '@testing-library/jest-native/extend-expect';

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), { virtual: true });

// --- react-native-reanimated mock ---
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ID = (t) => t;
  const NOOP = () => {};

  const AnimatedView = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref })
  );

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      Text: View,
      Image: View,
      ScrollView: View,
      createAnimatedComponent: () => AnimatedView,
    },
    useSharedValue: (init) => {
      const ref = require('react').useRef({ value: init });
      return ref.current;
    },
    useAnimatedStyle: () => ({}),
    withSpring: (toValue, _config, cb) => { cb?.(true); return toValue; },
    withTiming: (toValue, _config, cb) => { cb?.(true); return toValue; },
    withDecay: ID,
    withDelay: (_delay, anim) => anim,
    withSequence: (...anims) => anims[anims.length - 1],
    withRepeat: (anim) => anim,
    Easing: {
      ease: () => {},
      inOut: (fn) => fn,
    },
    interpolate: (value, inputRange, outputRange) => {
      if (value <= inputRange[0]) return outputRange[0];
      if (value >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
      return outputRange[0];
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    runOnJS: ID,
    runOnUI: ID,
    createAnimatedComponent: () => AnimatedView,
    useAnimatedGestureHandler: NOOP,
    useEvent: () => ({ current: NOOP }),
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
  };
});

// --- react-native-gesture-handler mock ---
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  const GestureDetector = ({ children }) => children;

  const gestureBuilder = () => {
    const g = {};
    const chain = (name) => (..._args) => { g[name] = true; return g; };
    ['activeOffsetX', 'failOffsetY', 'maxDuration', 'numberOfTaps', 'onUpdate', 'onEnd', 'onStart', 'onBegin', 'onFinalize'].forEach(
      (m) => { g[m] = chain(m); }
    );
    // Return a proxy so any unlisted chainable method also works
    return new Proxy(g, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return (..._args) => g;
      },
    });
  };

  return {
    GestureDetector,
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    LongPressGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    NativeViewGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    Swipeable: View,
    DrawerLayout: View,
    Gesture: {
      Pan: gestureBuilder,
      Tap: gestureBuilder,
      Exclusive: (...gestures) => gestures[0],
      Race: (...gestures) => gestures[0],
      Simultaneous: (...gestures) => gestures[0],
    },
    Directions: {},
    State: { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }) => React.createElement(View, props, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props) => React.createElement(Text, props, 'icon');
  return {
    Ionicons: Icon,
    MaterialCommunityIcons: Icon,
    FontAwesome5: Icon,
  };
});

const createMockNavigator = () => {
  const React = require('react');
  const Screen = ({ component: Component, children, ...props }) => {
    if (Component) return React.createElement(Component, props);
    return children || null;
  };
  const Navigator = ({ children, initialRouteName }) => {
    const childArray = React.Children.toArray(children);
    if (childArray.length === 0) return null;
    if (initialRouteName) {
      const match = childArray.find((child) => child?.props?.name === initialRouteName);
      if (match) return match;
    }
    return childArray[0];
  };
  return { Navigator, Screen };
};

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => createMockNavigator(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => createMockNavigator(),
}));

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => React.createElement(View, { ...props, ref }, props.children));
  return { WebView, default: WebView };
});
