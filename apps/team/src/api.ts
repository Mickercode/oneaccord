import { createClient, createTokenStore } from '@oa/ui';
import { enqueue, flush } from './offline';

// Same origin as the app itself. Vite proxies it in development.
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

/** The signed-in team member, handed over by the magic link. */
export const teamSession = createTokenStore('oa.team');

export const api = createClient(baseUrl, { getToken: teamSession.get });

/**
 * A write that must not be lost. Offline it goes to the queue and the screen
 * carries on; the server's unique check-in index makes the replay harmless.
 */
export async function postDurable(path: string, body: unknown, label: string): Promise<boolean> {
  if (!navigator.onLine) {
    await enqueue({ path, body, label });
    return false;
  }
  try {
    await api.post(path, body);
    return true;
  } catch (error) {
    const status = (error as { status?: number }).status;
    // A network failure, not a refusal: hold it and try again later.
    if (!status || status >= 500) {
      await enqueue({ path, body, label });
      return false;
    }
    throw error;
  }
}

export const sendQueued = () => flush((path, body) => api.post(path, body));
