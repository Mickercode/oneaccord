import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { TripSummary } from '@oa/types';

// socket.io reads a bare path as a namespace, so this must be an origin.
const url = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) socket = io(url, { withCredentials: true, transports: ['websocket', 'polling'] });
  return socket;
}

/** BD-1: the count beside the code moves as people scan. */
export function useTripCount(tripId: string | undefined, initial: number) {
  const [count, setCount] = useState(initial);

  useEffect(() => setCount(initial), [initial]);

  useEffect(() => {
    if (!tripId) return;
    const connection = getSocket();
    const onUpdate = (trip: TripSummary) => {
      if (trip.id === tripId) setCount(trip.boardedCount);
    };
    connection.emit('watch:trip', tripId, (reply: { boardedCount: number } | null) => {
      if (reply) setCount(reply.boardedCount);
    });
    connection.on('trip:update', onUpdate);
    return () => {
      connection.emit('unwatch', `trip:${tripId}`);
      connection.off('trip:update', onUpdate);
    };
  }, [tripId]);

  return count;
}
