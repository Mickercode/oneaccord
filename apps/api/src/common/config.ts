/** Every environment value the API reads, in one place. */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  /** Signs boarding codes, gate tokens, pass cookies and team sessions. */
  secret: string;
  /** Where the API answers. Magic links are built from this. */
  apiUrl: string;
  /** Where the attendee app lives: the QR codes point here. */
  webUrl: string;
  teamUrl: string;
  adminUrl: string;
  cookieDomain?: string;
  mail: {
    provider: 'resend' | 'postmark' | 'console';
    apiKey?: string;
    from: string;
    replyTo?: string;
  };
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
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
   * The three apps ship as one deployment: the attendee app at the root, the
   * team app at /team, the dashboard at /admin. So WEB_URL is the only address
   * worth setting and the other two fall out of it. Either can still be set
   * on its own if they are ever split apart again.
   *
   * In development each app has its own Vite port.
   */
  const appsUrl = process.env.WEB_URL?.replace(/\/$/, '');
  const appUrl = (path: string, devPort: number) =>
    appsUrl ? `${appsUrl}${path}` : dev ? `http://localhost:${devPort}` : undefined;

  return {
    port,
    nodeEnv,
    databaseUrl: required(
      'DATABASE_URL',
      dev ? 'postgresql://postgres:postgres@127.0.0.1:55433/oneaccord' : undefined,
    ),
    secret: required('APP_SECRET', dev ? 'dev-secret-change-me-before-any-real-event' : undefined),
    apiUrl: required('API_URL', dev ? `http://localhost:${port}/api` : undefined),
    // Trailing slashes are easy to paste in and would turn a sign-in
    // redirect into https://host//#t=, so take them off once here.
    webUrl: trimSlash(required('WEB_URL', appUrl('', 5173))),
    teamUrl: trimSlash(required('TEAM_URL', appUrl('/team', 5174))),
    adminUrl: trimSlash(required('ADMIN_URL', appUrl('/admin', 5175))),
    cookieDomain: process.env.COOKIE_DOMAIN,
    mail: {
      provider: (process.env.MAIL_PROVIDER as AppConfig['mail']['provider']) ?? 'console',
      apiKey: process.env.MAIL_API_KEY,
      from: process.env.MAIL_FROM ?? 'One Accord <passes@oneaccord.example>',
      replyTo: process.env.MAIL_REPLY_TO,
    },
  };
}

export const CONFIG = 'APP_CONFIG';
