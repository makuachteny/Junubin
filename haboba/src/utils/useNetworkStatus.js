// AnaJunubin — Network Status Hook + Provider
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import * as Network from 'expo-network';

const NetworkContext = createContext({ isConnected: true, type: null });

// Require multiple consecutive offline readings before reporting offline
const OFFLINE_THRESHOLD = 4;

export function NetworkProvider({ children }) {
  const [isConnected, setIsConnected] = useState(true);
  const [type, setType] = useState(null);
  const offlineCountRef = useRef(0);

  useEffect(() => {
    // In dev mode (Expo Go), expo-network is unreliable — skip checks entirely
    if (__DEV__) return;

    let mounted = true;

    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!mounted) return;

        // Determine if truly offline — try a real fetch as fallback
        let connected = state.isConnected !== false;

        if (!connected || state.isInternetReachable === false) {
          // Double-check with a real network request
          try {
            const resp = await fetch('https://clients3.google.com/generate_204', {
              method: 'HEAD',
              cache: 'no-store',
            });
            connected = resp.ok || resp.status === 204;
          } catch {
            connected = false;
          }
        }

        if (!connected) {
          offlineCountRef.current += 1;
          if (offlineCountRef.current >= OFFLINE_THRESHOLD) {
            setIsConnected(false);
          }
        } else {
          offlineCountRef.current = 0;
          setIsConnected(true);
        }

        setType(state.type ?? null);
      } catch {
        if (mounted) setIsConnected(true);
      }
    };

    // Delay first check so app finishes initializing
    const initialTimer = setTimeout(check, 5000);
    const interval = setInterval(check, 15000);

    return () => {
      mounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  const value = useMemo(() => ({ isConnected, type }), [isConnected, type]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkContext);
}
