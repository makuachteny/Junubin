// Background→foreground refresh hook.
//
// React Native apps suspend in the background and resume from cached
// state on return. For a multi-device app like JuNubin, that cached
// state can be hours stale: profile edits, blocks, and new messages
// can all happen on other devices in the meantime.
//
// We don't want to refresh on *every* foreground (an app the user
// flicks back to after 30 seconds shouldn't re-hit the network), so
// the hook gates on a minimum-idle threshold. Default 60s — long
// enough that quick context-switches don't cause flickers, short
// enough that a returning-from-lunch user sees fresh data.

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export function useAppStateRefresh(onForeground, { minIdleMs = 60_000 } = {}) {
  const lastBackgroundedAt = useRef(null);
  const handlerRef = useRef(onForeground);

  // Keep the handler ref fresh without re-subscribing on every render.
  useEffect(() => { handlerRef.current = onForeground; }, [onForeground]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundedAt.current = Date.now();
        return;
      }
      if (next === 'active') {
        const idleAt = lastBackgroundedAt.current;
        // First foreground (no recorded background) — skip; the
        // initial mount already loaded fresh state.
        if (idleAt == null) return;
        const idleMs = Date.now() - idleAt;
        lastBackgroundedAt.current = null;
        if (idleMs >= minIdleMs) {
          try { handlerRef.current?.({ idleMs }); } catch {}
        }
      }
    });
    return () => sub?.remove?.();
  }, [minIdleMs]);
}
