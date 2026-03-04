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
   * Listen for new matches.
   */
  const onMatchCreated = useCallback((callback) => {
    if (!userId) return () => {};

    if (matchSubscriptionRef.current) {
      supabase.removeChannel(matchSubscriptionRef.current);
    }

    // Listen for matches where user is either userA or userB
    const channel = supabase
      .channel(`matches:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Match',
        },
        (payload) => {
          const match = payload.new;
          if (match.userAId === userId || match.userBId === userId) {
            callback(match);
          }
        }
      )
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
