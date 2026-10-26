import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppConfig, CONFIG } from '../common/config';
import { RenderedEmail } from './templates';

export const MAIL_QUEUE = 'mail';

export interface MailJob {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectQueue(MAIL_QUEUE) private readonly queue: Queue<MailJob>,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * PS-1 asks for the pass within a minute, so registration hands the mail to
   * the queue and answers the attendee straight away.
   */
  async enqueue(to: string, email: RenderedEmail): Promise<void> {
    await this.queue.add(
      'send',
      { to, subject: email.subject, html: email.html, text: email.text },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    );
  }

  async enqueueMany(messages: Array<{ to: string; email: RenderedEmail }>): Promise<number> {
    if (messages.length === 0) return 0;
    await this.queue.addBulk(
      messages.map(({ to, email }) => ({
        name: 'send',
        data: { to, subject: email.subject, html: email.html, text: email.text },
        opts: {
          attempts: 5,
          backoff: { type: 'exponential' as const, delay: 2_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      })),
    );
    return messages.length;
  }

  /** Called by the queue worker. Throws so BullMQ can retry. */
  async deliver(job: MailJob): Promise<void> {
    const { provider, apiKey, from, replyTo } = this.config.mail;

    if (provider === 'console' || !apiKey) {
      // The plain-text twin goes to the log as well, so a magic link or a
      // pass code can actually be followed while working locally.
      this.logger.log(
        `[mail:console] to=${job.to} subject="${job.subject}"\n${job.text.replace(/^/gm, '  | ')}`,
      );
      return;
    }

    if (provider === 'resend') {
      await this.post('https://api.resend.com/emails', apiKey, {
        from,
        to: [job.to],
        subject: job.subject,
        html: job.html,
        text: job.text,
        reply_to: replyTo,
      });
      return;
    }

    await this.post(
      'https://api.postmarkapp.com/email',
      apiKey,
      {
        From: from,
        To: job.to,
        Subject: job.subject,
        HtmlBody: job.html,
        TextBody: job.text,
        ReplyTo: replyTo,
        MessageStream: 'outbound',
      },
      'postmark',
    );
  }

  private async post(
    url: string,
    apiKey: string,
    body: unknown,
    style: 'bearer' | 'postmark' = 'bearer',
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(style === 'bearer'
          ? { authorization: `Bearer ${apiKey}` }
          : { 'X-Postmark-Server-Token': apiKey }),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Mail provider refused the message (${response.status}): ${detail.slice(0, 300)}`,
      );
    }
  }
}
