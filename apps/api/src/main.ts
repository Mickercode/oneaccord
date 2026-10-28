import 'dotenv/config';
import 'reflect-metadata';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadConfig } from './common/config';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // The apps are served from this same origin, so every API route lives
  // under /api and cannot collide with a page the attendee app owns.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.use(cookieParser());
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The apps are plain static files from this origin; the default CSP
      // blocks their inline module preloads.
      contentSecurityPolicy: false,
    }),
  );
  app.set('trust proxy', 1);

  // An allowed origin is scheme, host and port — never a path. The team and
  // dashboard addresses carry one (/team, /admin) because the three apps ship
  // as a single deployment, so reduce them before handing them to CORS, or
  // every entry silently fails to match.
  const allowedOrigins = [
    ...new Set(
      [config.webUrl, config.teamUrl, config.adminUrl].map((address) => {
        try {
          return new URL(address).origin;
        } catch {
          return address;
        }
      }),
    ),
  ];

  app.enableCors({ origin: allowedOrigins, credentials: true });
  new Logger('One Accord').log(`Allowing requests from ${allowedOrigins.join(', ')}.`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  if (config.nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('One Accord')
        .setDescription('Registration and check-in for Upper Room.')
        .setVersion('1.0')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
  await app.listen(config.port, '0.0.0.0');
  new Logger('One Accord').log(`API listening on ${config.port} (${config.nodeEnv}).`);
}

void bootstrap();
