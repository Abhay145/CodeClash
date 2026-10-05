import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001';

/**
 * Creates and manages a Socket.IO connection to the Realtime Server.
 * Automatically registers the user's UID on connect.
 *
 * @param {string|null} userId  - Firebase Auth UID, or null if not signed in
 * @returns {{ socket: Socket|null, emit: Function }}
 */
export function useSocket(userId) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const socket = io(REALTIME_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[socket] connected', socket.id);
      socket.emit('register', userId);
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[socket] connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { socketRef, emit };
}
