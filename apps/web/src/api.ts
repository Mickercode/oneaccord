import { createClient, createTokenStore } from '@oa/ui';

// Same origin as the app itself. Vite proxies it in development.
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

/** PS-2: the pass this phone is carrying. Set when the UR Pass is opened. */
export const passSession = createTokenStore('oa.pass');

export const api = createClient(baseUrl, { getToken: passSession.get });

/** The slug on the flyer. One city at a time for version 1. */
export const EVENT_SLUG = import.meta.env.VITE_EVENT_SLUG ?? 'lagos-2026';
