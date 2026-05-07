// Realtime broadcaster ↔ viewer channel for a single live stream.
//
// Both GoLiveScreen (host) and LiveViewScreen (viewer) call this hook
// with the same `streamId`. Broadcasts go through Supabase Realtime's
// broadcast layer (no DB roundtrip — fire-and-forget) so comments,
// reactions, and gifts arrive on the other side in <250ms.
//
// Events:
//   `comment` { id, userId, name, text, ts }
//   `reaction` { id, emoji, ts }
//   `gift`     { id, sender, gift: {id,emoji,name,cost}, count, ts }
//   `viewer-join` / `viewer-leave` (presence-derived)
//
// This is the *social* layer of live. The actual video stream remains
// preview-only on the host until we add an SFU (Daily.co / LiveKit).

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../config/supabase';

export function useLiveChannel(streamId, { onComment, onReaction, onGift } = {}) {
  const channelRef = useRef(null);
  const handlersRef = useRef({ onComment, onReaction, onGift });

  // Keep handlers fresh without re-subscribing on every render.
  useEffect(() => {
    handlersRef.current = { onComment, onReaction, onGift };
  }, [onComment, onReaction, onGift]);

  useEffect(() => {
    if (!streamId) return undefined;
    const channel = supabase.channel(`live:${streamId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'comment' }, ({ payload }) => {
      handlersRef.current.onComment?.(payload);
    });
    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      handlersRef.current.onReaction?.(payload);
    });
    channel.on('broadcast', { event: 'gift' }, ({ payload }) => {
      handlersRef.current.onGift?.(payload);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {
        // Best-effort teardown; nothing the user can act on.
      }
      channelRef.current = null;
    };
  }, [streamId]);

  const send = useCallback((event, payload) => {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      channel.send({ type: 'broadcast', event, payload: { ...payload, ts: Date.now() } });
    } catch {
      // Realtime can drop frames during reconnection — non-fatal.
    }
  }, []);

  return {
    sendComment: useCallback((payload) => send('comment', payload), [send]),
    sendReaction: useCallback((payload) => send('reaction', payload), [send]),
    sendGift: useCallback((payload) => send('gift', payload), [send]),
  };
}
