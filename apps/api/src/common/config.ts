/** Every environment value the API reads, in one place. */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  redisUrl: string;
  /** Signs boarding codes, gate tokens, pass cookies and team sessions. */
  secret: string;
  /** Where the API answers. Magic links are built from this. */
  apiUrl: string;
  /** Where the attendee app lives: the QR codes point here. */
  webUrl: string;
  teamUrl: string;
  adminUrl: string;
  cookieDomain?: string;
  /** Serve the three built apps from this process. One origin, one deploy. */
  serveApps: boolean;
  mail: {
    provider: 'resend' | 'postmark' | 'console';
    apiKey?: string;
    from: string;
    replyTo?: string;
  };
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const dev = nodeEnv !== 'production';
  const port = Number(process.env.PORT ?? 3000);

  /**
   * The three apps deploy on their own, each at the root of its own address,
   * so each one is named here. PUBLIC_URL is the exception: it only applies
   * when SERVE_APPS puts everything back behind one origin, where the apps sit
   * at /, /team and /admin.
   */
  const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, '');
  const oneOrigin = process.env.SERVE_APPS === 'true' && !!publicUrl;
  const appUrl = (path: string, devPort: number) =>
    oneOrigin ? `${publicUrl}${path}` : dev ? `http://localhost:${devPort}` : undefined;

  return {
    port,
    nodeEnv,
    databaseUrl: required(
      'DATABASE_URL',
      dev ? 'postgresql://postgres:postgres@127.0.0.1:55433/oneaccord' : undefined,
    ),
    redisUrl: required('REDIS_URL', dev ? 'redis://127.0.0.1:6379' : undefined),
    secret: required('APP_SECRET', dev ? 'dev-secret-change-me-before-any-real-event' : undefined),
    apiUrl: required(
      'API_URL',
      oneOrigin ? `${publicUrl}/api` : dev ? `http://localhost:${port}/api` : undefined,
    ),
    webUrl: required('WEB_URL', appUrl('', 5173)),
    teamUrl: required('TEAM_URL', appUrl('/team', 5174)),
    adminUrl: required('ADMIN_URL', appUrl('/admin', 5175)),
    cookieDomain: process.env.COOKIE_DOMAIN,
    // The apps deploy separately, so this is off unless asked for. Set it
    // true to serve them from this process instead, which also puts them back
    // on one origin and lets the cookie do the work on its own.
    serveApps: process.env.SERVE_APPS === 'true',
    mail: {
      provider: (process.env.MAIL_PROVIDER as AppConfig['mail']['provider']) ?? 'console',
      apiKey: process.env.MAIL_API_KEY,
      from: process.env.MAIL_FROM ?? 'One Accord <passes@oneaccord.example>',
      replyTo: process.env.MAIL_REPLY_TO,
    },
  };
}

export const CONFIG = 'APP_CONFIG';
