import { createClient } from '@oa/ui';

// Same origin as the app itself. Vite proxies it in development.
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

export const api = createClient(baseUrl);

/** The slug on the flyer. One city at a time for version 1. */
export const EVENT_SLUG = import.meta.env.VITE_EVENT_SLUG ?? 'lagos-2026';
