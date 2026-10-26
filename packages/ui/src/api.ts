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

export function createClient(baseUrl: string) {
  const base = baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      // The UR Pass cookie and the team session both ride on this.
      credentials: 'include',
      headers: options.body ? { 'content-type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
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
    get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
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
