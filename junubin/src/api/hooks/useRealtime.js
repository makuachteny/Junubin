import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../config/supabase';

/**
 * Supabase Realtime hook — replaces Socket.io useSocket.
 * Provides live messages, match notifications, typing indicators, and read receipts.
 */
export function useRealtime(userId) {
  const channelsRef = useRef({});
  const messageCallbackRef = useRef(null);
  const matchSubscriptionRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingHandlersRef = useRef(new Set());

  // Clean up all subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const channel of Object.values(channelsRef.current)) {
        supabase.removeChannel(channel);
      }
      channelsRef.current = {};
      if (matchSubscriptionRef.current) {
        supabase.removeChannel(matchSubscriptionRef.current);
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  /**
   * Subscribe to new messages in a conversation via postgres_changes.
   */
  const joinConversation = useCallback((conversationId) => {
    if (channelsRef.current[conversationId]) return;

    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          messageCallbackRef.current?.(payload.new);
        }
      )
      .subscribe();

    channelsRef.current[conversationId] = channel;
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    const channel = channelsRef.current[conversationId];
    if (channel) {
      supabase.removeChannel(channel);
      delete channelsRef.current[conversationId];
    }
  }, []);

  /**
   * Listen for new messages in the active conversation.
   */
  const onMessage = useCallback((conversationId, callback) => {
    // Ensure channel exists
    joinConversation(conversationId);

    // Delegate to the callback ref used by joinConversation's INSERT handler
    messageCallbackRef.current = callback;

    return () => {
      messageCallbackRef.current = null;
    };
  }, [joinConversation]);

  /**
   * Listen for new matches AND match teardowns. The unmatch RPC issued
   * from another device deletes a Match row; without listening for
   * DELETE, the local matches list keeps showing a peer the user has
   * already broken up with. The same callback fires for both events;
   * the second arg distinguishes:
   *
   *   onMatchCreated((match, eventType) => { ... })
   *
   * `eventType` is 'INSERT' or 'DELETE'. Existing callers that ignore
   * the second arg keep working — they just get a refetch trigger on
   * either event, which is the most common shape they want anyway.
   */
  const onMatchCreated = useCallback((callback) => {
    if (!userId) return () => {};

    if (matchSubscriptionRef.current) {
      supabase.removeChannel(matchSubscriptionRef.current);
    }

    // INSERT and DELETE go through the same channel + callback. We
    // can't filter server-side on userId for INSERT (the row's
    // userAId/userBId is dynamic), so the handler does it client-side.
    const handle = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.userAId === userId || row.userBId === userId) {
        callback(row, payload.eventType);
      }
    };

    const channel = supabase
      .channel(`matches:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Match' }, handle)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Match' }, handle)
      .subscribe();

    matchSubscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (matchSubscriptionRef.current === channel) {
        matchSubscriptionRef.current = null;
      }
    };
  }, [userId]);

  /**
   * Typing indicators via Supabase Realtime Broadcast.
   */
  const emitTypingStart = useCallback((conversationId) => {
    // Debounce: skip if timer is still active
    if (typingTimerRef.current) return;

    const channel = channelsRef.current[conversationId];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, typing: true },
      });
    }

    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 300);
  }, [userId]);

  const emitTypingStop = useCallback((conversationId) => {
    const channel = channelsRef.current[conversationId];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, typing: false },
      });
    }
  }, [userId]);

  const onTypingStart = useCallback((conversationId, callback) => {
    const channel = channelsRef.current[conversationId];
    if (!channel) return () => {};

    const key = `typing-start:${conversationId}`;
    if (typingHandlersRef.current.has(key)) return () => {};
    typingHandlersRef.current.add(key);

    const handler = (payload) => {
      if (payload.payload?.typing === true && payload.payload?.userId !== userId) {
        callback(payload.payload);
      }
    };

    channel.on('broadcast', { event: 'typing' }, handler);
    return () => {
      typingHandlersRef.current.delete(key);
    };
  }, [userId]);

  const onTypingStop = useCallback((conversationId, callback) => {
    const channel = channelsRef.current[conversationId];
    if (!channel) return () => {};

    const key = `typing-stop:${conversationId}`;
    if (typingHandlersRef.current.has(key)) return () => {};
    typingHandlersRef.current.add(key);

    const handler = (payload) => {
      if (payload.payload?.typing === false && payload.payload?.userId !== userId) {
        callback(payload.payload);
      }
    };

    channel.on('broadcast', { event: 'typing' }, handler);
    return () => {
      typingHandlersRef.current.delete(key);
    };
  }, [userId]);

  /**
   * Read receipts via Broadcast.
   */
  const emitReadReceipt = useCallback((conversationId) => {
    const channel = channelsRef.current[conversationId];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'read',
        payload: { userId },
      });
    }
  }, [userId]);

  return {
    joinConversation,
    leaveConversation,
    onMessage,
    onMatchCreated,
    emitTypingStart,
    emitTypingStop,
    onTypingStart,
    onTypingStop,
    emitReadReceipt,
  };
}
