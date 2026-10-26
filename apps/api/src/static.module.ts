import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Logger, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { loadConfig } from './common/config';

/**
 * One origin for everything. The three built apps are served beside the API,
 * which is what makes the UR Pass cookie work without a word of configuration:
 * the phone that opened the pass is on the same site when it scans the
 * delegate's code.
 *
 *   /           the attendee app
 *   /team       delegates and ushers
 *   /admin      setup and the live dashboard
 *   /api/*      this API
 *   /health     for Railway and the load balancer
 *
 * In development this is off and Vite serves the apps, each proxying /api here.
 */
const logger = new Logger('Apps');

/** Where an app's `dist` sits, both from `apps/api/dist` and from the repo. */
function distOf(app: string): string | null {
  const candidates = [
    join(__dirname, '..', '..', app, 'dist'),
    join(process.cwd(), 'apps', app, 'dist'),
    join(__dirname, '..', '..', '..', app, 'dist'),
  ];
  return candidates.find((path) => existsSync(join(path, 'index.html'))) ?? null;
}

/** Never let the apps swallow the API, the socket or the health check. */
const RESERVED = ['/api*', '/socket.io*', '/health'];

function serve() {
  if (!loadConfig().serveApps) return [];

  // Order matters: the attendee app sits at the root and must be registered
  // last, or it would answer for /team and /admin as well.
  const mounts: Array<{ app: string; serveRoot: string }> = [
    { app: 'admin', serveRoot: '/admin' },
    { app: 'team', serveRoot: '/team' },
    { app: 'web', serveRoot: '/' },
  ];

  const options = [];
  for (const mount of mounts) {
    const rootPath = distOf(mount.app);
    if (!rootPath) {
      logger.warn(`No build for the ${mount.app} app; ${mount.serveRoot} will not be served.`);
      continue;
    }
    options.push({
      rootPath,
      serveRoot: mount.serveRoot === '/' ? undefined : mount.serveRoot,
      // Client-side routing: anything unmatched inside the app is its
      // index. The pattern is relative to serveRoot.
      renderPath: '*',
      exclude: RESERVED,
      serveStaticOptions: {
        // Hashed assets can be cached hard; index.html never.
        setHeaders: (res: { setHeader: (k: string, v: string) => void }, path: string) => {
          res.setHeader(
            'Cache-Control',
            path.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
          );
        },
      },
    });
    logger.log(`Serving the ${mount.app} app at ${mount.serveRoot}`);
  }
  return options;
}

const options = serve();

@Module({
  // With no options at all, forRoot would fall back to serving a default
  // directory, so an API-only process imports nothing here.
  imports: options.length > 0 ? [ServeStaticModule.forRoot(...options)] : [],
})
export class StaticModule {}
