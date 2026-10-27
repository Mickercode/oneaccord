import { createClient, createTokenStore } from '@oa/ui';

// Same origin as the app itself. Vite proxies it in development.
const baseUrl = import.meta.env.VITE_API_URL ?? '/api';

/** The signed-in team member, handed over by the magic link. */
export const teamSession = createTokenStore('oa.admin');

export const api = createClient(baseUrl, { getToken: teamSession.get });
export const apiBase = baseUrl.replace(/\/$/, '');
