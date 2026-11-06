import React, { createContext, useCallback, useContext } from 'react';

const noop = () => {};

const TabBarVisibilityContext = createContext({
  hideForScroll: noop,
  showAfterScroll: noop,
});

export function TabBarVisibilityProvider({ children, hideForScroll, showAfterScroll }) {
  return (
    <TabBarVisibilityContext.Provider value={{ hideForScroll, showAfterScroll }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarScrollVisibility() {
  const { hideForScroll, showAfterScroll } = useContext(TabBarVisibilityContext);

  return {
    scrollEventThrottle: 16,
    onScrollBeginDrag: hideForScroll,
    onScroll: hideForScroll,
    onScrollEndDrag: showAfterScroll,
    onMomentumScrollEnd: showAfterScroll,
  };
}
