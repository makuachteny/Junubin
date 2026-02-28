import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../config/api';

// Socket.IO server is on the same host, just strip /v1
const SOCKET_URL = API_BASE_URL.replace(/\/v1$/, '');

export function useSocket(token) {
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Re-register any active listeners
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinConversation = useCallback((conversationId) => {
    socketRef.current?.emit('JOIN_CONVERSATION', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    socketRef.current?.emit('LEAVE_CONVERSATION', conversationId);
  }, []);

  const sendMessage = useCallback((data, ack) => {
    socketRef.current?.emit('SEND_MESSAGE', data, ack);
  }, []);

  const emitTypingStart = useCallback((conversationId) => {
    socketRef.current?.emit('TYPING_START', { conversationId });
  }, []);

  const emitTypingStop = useCallback((conversationId) => {
    socketRef.current?.emit('TYPING_STOP', { conversationId });
  }, []);

  const onMessage = useCallback((callback) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on('NEW_MESSAGE', callback);
    return () => socket.off('NEW_MESSAGE', callback);
  }, []);

  const onTypingStart = useCallback((callback) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on('TYPING_START', callback);
    return () => socket.off('TYPING_START', callback);
  }, []);

  const onTypingStop = useCallback((callback) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on('TYPING_STOP', callback);
    return () => socket.off('TYPING_STOP', callback);
  }, []);

  const onMatchCreated = useCallback((callback) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on('MATCH_CREATED', callback);
    return () => socket.off('MATCH_CREATED', callback);
  }, []);

  return {
    socket: socketRef,
    joinConversation,
    leaveConversation,
    sendMessage,
    emitTypingStart,
    emitTypingStop,
    onMessage,
    onTypingStart,
    onTypingStop,
    onMatchCreated,
  };
}
