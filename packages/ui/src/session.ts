/**
 * Where an app keeps the session the API handed it.
 *
 * The API also sets an httpOnly cookie, which is the better carrier and is
 * used whenever the app and the API share a site. This is the fallback for
 * when they do not: apps on one host, API on another, where the browser
 * withholds the cookie. Safari withholds it outright, so this is not an
 * edge case.
 *
 * Everything here tolerates storage being unavailable — private windows,
 * blocked site data — by behaving as though nothing was ever stored.
 */
export interface TokenStore {
  get(): string | null;
  set(token: string): void;
  clear(): void;
  /** Lift a token out of the URL fragment, store it, and tidy the address bar. */
  captureFromFragment(): string | null;
}

export function createTokenStore(key: string): TokenStore {
  const get = (): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const set = (token: string): void => {
    try {
      window.localStorage.setItem(key, token);
    } catch {
      // A private window. The cookie may still carry it; if not, the attendee
      // types their pass code, which is what that fallback is for.
    }
  };

  const clear = (): void => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nothing to clear */
    }
  };

  const captureFromFragment = (): string | null => {
    const fragment = window.location.hash.replace(/^#/, '');
    if (!fragment) return null;

    const token = new URLSearchParams(fragment).get('t');
    if (!token) return null;

    set(token);
    // Take it out of the address bar so it is not re-shared or bookmarked.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return token;
  };

  return { get, set, clear, captureFromFragment };
}
