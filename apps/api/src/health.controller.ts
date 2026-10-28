import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './common/prisma.service';
import { MailService } from './mail/mail.service';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** What the status page and the load balancer read. */
  @Get()
  async health() {
    const [database, outbox] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.mail.pending(),
    ]);
    const ok = database.status === 'fulfilled';
    return {
      ok,
      database: database.status === 'fulfilled' ? 'up' : 'down',
      // Mail waiting to go out. A number that climbs and never falls means
      // the provider is refusing and the passes are not arriving.
      mailWaiting: outbox.status === 'fulfilled' ? outbox.value : null,
      at: new Date().toISOString(),
    };
  }
}
