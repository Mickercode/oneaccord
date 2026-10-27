/** The one place every app talks to the API from. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export interface ClientOptions {
  /**
   * The session to send as a bearer token. The API also accepts its own
   * cookie, so this is only needed when the app and the API are on different
   * sites and the browser withholds it.
   */
  getToken?: () => string | null;
}

export function createClient(baseUrl: string, options: ClientOptions = {}) {
  const base = baseUrl.replace(/\/$/, '');

  async function send<T>(path: string, request: ApiOptions = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (request.body) headers['content-type'] = 'application/json';

    const token = options.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;

    const response = await fetch(`${base}${path}`, {
      method: request.method ?? 'GET',
      // Carries the cookie when the app and the API share a site. When they
      // do not, the bearer token above does the same job.
      credentials: 'include',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: request.signal,
    });

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    const payload = text ? safeJson(text) : null;

    if (!response.ok) {
      const message =
        (payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : null) ?? 'Something went wrong. Please try again.';
      const code =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : undefined;
      throw new ApiError(response.status, message, code);
    }

    return payload as T;
  }

  return {
    base,
    get: <T>(path: string, signal?: AbortSignal) => send<T>(path, { signal }),
    post: <T>(path: string, body?: unknown) => send<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: unknown) => send<T>(path, { method: 'PATCH', body }),
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export type ApiClient = ReturnType<typeof createClient>;
