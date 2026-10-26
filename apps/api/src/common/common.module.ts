import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import Redis from 'ioredis';
import { AppConfig, CONFIG, loadConfig } from './config';
import { PrismaService } from './prisma.service';
import { TokensService } from './tokens.service';
import { CookiesService } from './cookies.service';
import { TeamGuard } from './team.guard';

export const REDIS = 'REDIS';

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
      provide: REDIS,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => new Redis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    PrismaService,
    TokensService,
    CookiesService,
    TeamGuard,
  ],
  exports: [CONFIG, REDIS, PrismaService, TokensService, CookiesService, TeamGuard, JwtModule],
})
export class CommonModule {}
