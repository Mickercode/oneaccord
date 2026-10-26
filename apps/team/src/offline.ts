import { get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';

/**
 * BD-9: the delegate's screen keeps working with a weak signal and syncs when
 * it reconnects. Every queued action is idempotent on the server — a check-in
 * is unique per person and stage — so replaying the queue is always safe.
 */
export interface QueuedAction {
  id: string;
  path: string;
  body?: unknown;
  label: string;
  queuedAt: number;
}

const KEY = 'oa:queue';
const listeners = new Set<(queue: QueuedAction[]) => void>();

async function read(): Promise<QueuedAction[]> {
  return (await get<QueuedAction[]>(KEY)) ?? [];
}

async function write(queue: QueuedAction[]): Promise<void> {
  await set(KEY, queue);
  for (const listener of listeners) listener(queue);
}

export async function enqueue(action: Omit<QueuedAction, 'id' | 'queuedAt'>): Promise<void> {
  const queue = await read();
  queue.push({ ...action, id: crypto.randomUUID(), queuedAt: Date.now() });
  await write(queue);
}

export async function queued(): Promise<QueuedAction[]> {
  return read();
}

/** Send what is waiting, oldest first, and stop at the first failure. */
export async function flush(
  post: (path: string, body?: unknown) => Promise<unknown>,
): Promise<number> {
  let sent = 0;
  for (;;) {
    const queue = await read();
    const next = queue[0];
    if (!next) break;
    try {
      await post(next.path, next.body);
    } catch (error) {
      // A rejection the server will never accept must not block the rest.
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        await write(queue.slice(1));
        continue;
      }
      break;
    }
    await write(queue.slice(1));
    sent += 1;
  }
  return sent;
}

/** The count in the corner of the delegate's screen, and whether we are online. */
export function useOfflineQueue(post: (path: string, body?: unknown) => Promise<unknown>) {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    listeners.add(setQueue);
    void read().then(setQueue);
    return () => {
      listeners.delete(setQueue);
    };
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flush(post);
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Also try on open, in case we were closed while the signal came back.
    if (navigator.onLine) void flush(post);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [post]);

  return { queue, online, pending: queue.length };
}
