import { createClient } from '@oa/ui';

// Same origin as the app itself. Vite proxies it in development.
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

export const api = createClient(baseUrl);
export const apiBase = baseUrl.replace(/\/$/, '');
