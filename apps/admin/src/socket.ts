import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { LiveSnapshot } from '@oa/types';

// socket.io reads a bare path as a namespace, so this must be an origin.
const url = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) socket = io(url, { withCredentials: true, transports: ['websocket', 'polling'] });
  return socket;
}

/** DB-1: the dashboard follows the event:<id> room. */
export function useLive(eventId: string | undefined, initial?: LiveSnapshot) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | undefined>(initial);
  const [connected, setConnected] = useState(false);

  useEffect(() => setSnapshot(initial), [initial]);

  useEffect(() => {
    if (!eventId) return;
    const connection = getSocket();

    const onConnect = () => {
      setConnected(true);
      connection.emit('watch:event', eventId, (reply: LiveSnapshot | null) => {
        if (reply) setSnapshot(reply);
      });
    };
    const onUpdate = (next: LiveSnapshot) => {
      if (next.eventId === eventId) setSnapshot(next);
    };
    const onDisconnect = () => setConnected(false);

    if (connection.connected) onConnect();
    connection.on('connect', onConnect);
    connection.on('live:update', onUpdate);
    connection.on('disconnect', onDisconnect);

    return () => {
      connection.emit('unwatch', `event:${eventId}`);
      connection.off('connect', onConnect);
      connection.off('live:update', onUpdate);
      connection.off('disconnect', onDisconnect);
    };
  }, [eventId]);

  return { snapshot, connected };
}
