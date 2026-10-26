import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { MailService, MAIL_QUEUE, type MailJob } from './mail.service';
import { RemindersProcessor, RemindersService, REMINDER_QUEUE } from './reminders.service';
import { loadConfig } from '../common/config';

@Injectable()
@Processor(MAIL_QUEUE, { concurrency: 20 })
export class MailProcessor extends WorkerHost {
  constructor(private readonly mail: MailService) {
    super();
  }

  async process(job: Job<MailJob>): Promise<void> {
    await this.mail.deliver(job.data);
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const url = new URL(loadConfig().redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: MAIL_QUEUE }, { name: REMINDER_QUEUE }),
  ],
  providers: [MailService, MailProcessor, RemindersService, RemindersProcessor],
  exports: [MailService, BullModule],
})
export class MailModule {}
