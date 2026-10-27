import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Pool } from 'pg';
import { AppConfig, CONFIG, loadConfig } from './config';
import { PrismaService } from './prisma.service';
import { TokensService } from './tokens.service';
import { SessionsService } from './sessions.service';
import { TeamGuard } from './team.guard';

/**
 * A small Postgres pool kept beside Prisma, purely so Socket.IO can use
 * LISTEN/NOTIFY to reach clients connected to another instance. Prisma does
 * not expose a raw connection, and this needs one that stays listening.
 */
export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({ secret: loadConfig().secret }),
    }),
  ],
  providers: [
    { provide: CONFIG, useFactory: loadConfig },
    {
      provide: PG_POOL,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => new Pool({ connectionString: config.databaseUrl, max: 4 }),
    },
    PrismaService,
    TokensService,
    SessionsService,
    TeamGuard,
  ],
  exports: [CONFIG, PG_POOL, PrismaService, TokensService, SessionsService, TeamGuard, JwtModule],
})
export class CommonModule {}
