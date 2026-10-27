import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { RenderedEmail } from './templates';

/** How often the sweep looks for mail to send. */
const SWEEP_EVERY_MS = 2_000;
/** Taken per sweep. The provider, not us, is the bottleneck here. */
const BATCH = 25;
/** Sent at once within a batch. */
const CONCURRENCY = 10;
/** After this many tries a message is left alone for someone to look at. */
const MAX_ATTEMPTS = 5;

interface OutboxRow {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attempts: number;
}

/**
 * Outgoing email, queued in Postgres.
 *
 * Registration writes a row and answers the attendee; a sweep drains it. That
 * keeps the registration rush off the mail provider's latency, and it means a
 * restart mid-send loses nothing — the row is still there, unsent.
 *
 * The claim is `FOR UPDATE SKIP LOCKED`, so any number of instances can sweep
 * the same table at once without two of them sending the same message.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private sweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    const timer = setInterval(() => {
      void this.sweep().catch((error) => this.logger.error(`Mail sweep failed: ${error}`));
    }, SWEEP_EVERY_MS);
    // Never hold the process open on this alone.
    timer.unref?.();
  }

  /** PS-1: hand the pass to the outbox and answer the attendee. */
  async enqueue(to: string, email: RenderedEmail): Promise<void> {
    await this.prisma.outboxEmail.create({
      data: { to, subject: email.subject, html: email.html, text: email.text },
    });
  }

  async enqueueMany(messages: Array<{ to: string; email: RenderedEmail }>): Promise<number> {
    if (messages.length === 0) return 0;
    const written = await this.prisma.outboxEmail.createMany({
      data: messages.map(({ to, email }) => ({
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })),
    });
    return written.count;
  }

  /**
   * Claim a batch and send it. Claiming raises `attempts` in the same
   * statement that selects the rows, so a crash between claiming and sending
   * costs one attempt rather than looping for ever.
   */
  async sweep(): Promise<{ sent: number; failed: number }> {
    if (this.sweeping) return { sent: 0, failed: 0 };
    this.sweeping = true;
    try {
      const claimed = await this.prisma.$queryRaw<OutboxRow[]>`
        UPDATE "OutboxEmail"
        SET attempts = attempts + 1
        WHERE id IN (
          SELECT id FROM "OutboxEmail"
          WHERE "sentAt" IS NULL
            AND "sendAfter" <= now()
            AND attempts < ${MAX_ATTEMPTS}
          ORDER BY "createdAt"
          LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "to", subject, html, text, attempts
      `;
      if (claimed.length === 0) return { sent: 0, failed: 0 };

      let sent = 0;
      let failed = 0;

      for (let i = 0; i < claimed.length; i += CONCURRENCY) {
        const slice = claimed.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(slice.map((row) => this.deliver(row)));

        await Promise.all(
          results.map((result, index) => {
            const row = slice[index];
            if (result.status === 'fulfilled') {
              sent += 1;
              return this.prisma.outboxEmail.update({
                where: { id: row.id },
                data: { sentAt: new Date(), lastError: null },
              });
            }
            failed += 1;
            const reason = String(result.reason).slice(0, 500);
            // Back off further each time: 4s, 8s, 16s, 32s.
            const wait = 2_000 * 2 ** row.attempts;
            if (row.attempts >= MAX_ATTEMPTS) {
              this.logger.error(`Giving up on mail to ${row.to} after ${row.attempts}: ${reason}`);
            }
            return this.prisma.outboxEmail.update({
              where: { id: row.id },
              data: { lastError: reason, sendAfter: new Date(Date.now() + wait) },
            });
          }),
        );
      }

      if (failed > 0) this.logger.warn(`Mail sweep: ${sent} sent, ${failed} to retry.`);
      return { sent, failed };
    } finally {
      this.sweeping = false;
    }
  }

  /** How many are still waiting, for the health check. */
  async pending(): Promise<number> {
    return this.prisma.outboxEmail.count({
      where: { sentAt: null, attempts: { lt: MAX_ATTEMPTS } },
    });
  }

  /** Throws, so the sweep knows to retry. */
  private async deliver(job: { to: string; subject: string; html: string; text: string }) {
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
