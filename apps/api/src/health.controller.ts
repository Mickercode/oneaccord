import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { PrismaService } from './common/prisma.service';
import { REDIS } from './common/common.module';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** What the status page and the load balancer read. */
  @Get()
  async health() {
    const [database, cache] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);
    const ok = database.status === 'fulfilled' && cache.status === 'fulfilled';
    return {
      ok,
      database: database.status === 'fulfilled' ? 'up' : 'down',
      redis: cache.status === 'fulfilled' ? 'up' : 'down',
      at: new Date().toISOString(),
    };
  }
}
