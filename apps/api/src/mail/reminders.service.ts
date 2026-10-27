import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { MailService } from './mail.service';
import { reminderEmail, type ReminderKind } from './templates';
import { MAIL_INCLUDE, passContext } from './pass-context';

const HOUR = 3_600_000;
const SWEEP_EVERY_MS = 5 * 60_000;
/** Rows read at a time. The sending itself is the mail queue's problem. */
const PAGE = 1_000;
/** A ceiling per sweep, so one run cannot hold the worker for ever. */
const MAX_PER_SWEEP = 50_000;

const LIVE_EVENTS = ['OPEN', 'CLOSED', 'LIVE'] as const;

/**
 * PS-4: a reminder the day before and three hours before departure.
 * A sweep every five minutes beats one timer per attendee: it survives a
 * restart, and a trip whose departure moves is picked up on the next pass.
 * Each sweep keeps paging until nothing is due, so a city's worth of
 * reminders goes out in one run rather than trickling over hours.
 */
@Injectable()
export class RemindersService implements OnModuleInit {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    // A plain interval is enough: the claim row below is what stops two
    // instances sending the same reminder, not the scheduler.
    const timer = setInterval(() => {
      void this.sweep().catch((error) => this.logger.error(`Reminder sweep failed: ${error}`));
    }, SWEEP_EVERY_MS);
    timer.unref?.();
  }

  async sweep(now = new Date()): Promise<{ sent: number }> {
    let sent = 0;
    // Three hours out wins over a day out, so nobody gets the wrong one late.
    sent += await this.send('THREE_HOURS', now, new Date(now.getTime() + 3 * HOUR));
    sent += await this.send(
      'DAY_BEFORE',
      new Date(now.getTime() + 3 * HOUR),
      new Date(now.getTime() + 24 * HOUR),
    );
    if (sent > 0) this.logger.log(`Queued ${sent} reminder(s).`);
    return { sent };
  }

  /** Everyone whose departure falls in (after, until] and who has not had this one. */
  private async send(kind: ReminderKind, after: Date, until: Date): Promise<number> {
    let sent = 0;

    for (let page = 0; page < MAX_PER_SWEEP / PAGE; page += 1) {
      const due = await this.due(kind, after, until);
      if (due.length === 0) break;

      for (const registration of due) {
        try {
          // Claiming the reminder first is what stops a double send: the
          // unique index refuses the second attempt, here or on another node.
          await this.prisma.reminderLog.create({
            data: { registrationId: registration.id, kind },
          });
        } catch {
          continue;
        }
        await this.mail.enqueue(
          registration.email,
          reminderEmail(passContext(registration, this.config), kind),
        );
        sent += 1;
      }

      if (due.length < PAGE) break;
    }

    return sent;
  }

  private async due(kind: ReminderKind, after: Date, until: Date) {
    const base: Prisma.RegistrationWhereInput = {
      consentEmail: true,
      unsubscribed: false,
      // The claim row is the cursor: once written, the row stops matching.
      reminders: { none: { kind } },
    };

    const [riders, everyoneElse] = await Promise.all([
      this.prisma.registration.findMany({
        where: {
          ...base,
          event: { status: { in: [...LIVE_EVENTS] } },
          trip: { departsAt: { gt: after, lte: until } },
        },
        include: MAIL_INCLUDE,
        take: PAGE,
      }),
      this.prisma.registration.findMany({
        where: {
          ...base,
          tripId: null,
          event: { status: { in: [...LIVE_EVENTS] }, startsAt: { gt: after, lte: until } },
        },
        include: MAIL_INCLUDE,
        take: PAGE,
      }),
    ]);

    return [...riders, ...everyoneElse];
  }
}
