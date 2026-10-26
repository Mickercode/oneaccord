import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { MessageRequest } from '@oa/types';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { MailService } from '../mail/mail.service';
import { teamMessageEmail } from '../mail/templates';
import { MAIL_INCLUDE, passContext } from '../mail/pass-context';

const PAGE = 500;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** MS-1: a note to a trip, a pickup point or everyone. */
  async send(
    eventId: string,
    dto: MessageRequest,
    createdById: string,
  ): Promise<{ id: string; sentCount: number }> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('We cannot find that event.');

    const where: Prisma.RegistrationWhereInput = { eventId };
    if (dto.audience === 'TRIP') where.tripId = dto.audienceId;
    if (dto.audience === 'PICKUP_POINT') where.pickupPointId = dto.audienceId;

    // MS-2: only an essential note, such as a changed departure time, goes to
    // someone who has opted out of updates.
    if (!dto.essential) {
      where.consentEmail = true;
      where.unsubscribed = false;
    }

    const message = await this.prisma.message.create({
      data: {
        eventId,
        audience: dto.audience,
        audienceId: dto.audienceId ?? null,
        subject: dto.subject,
        body: dto.body,
        essential: dto.essential,
        createdById,
      },
    });

    let sentCount = 0;
    let cursor: string | undefined;

    for (;;) {
      const batch = await this.prisma.registration.findMany({
        where,
        include: MAIL_INCLUDE,
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      sentCount += await this.mail.enqueueMany(
        batch.map((registration) => {
          const context = passContext(registration, this.config);
          return {
            to: registration.email,
            email: teamMessageEmail({
              fullName: registration.fullName,
              city: context.city,
              cityColour: context.cityColour,
              subject: dto.subject,
              body: dto.body,
              passUrl: context.passUrl,
              unsubscribeUrl: dto.essential ? undefined : context.unsubscribeUrl,
            }),
          };
        }),
      );

      cursor = batch[batch.length - 1]?.id;
      if (batch.length < PAGE) break;
    }

    await this.prisma.message.update({ where: { id: message.id }, data: { sentCount } });
    return { id: message.id, sentCount };
  }

  async list(eventId: string) {
    return this.prisma.message.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { createdBy: { select: { fullName: true } } },
    });
  }
}
