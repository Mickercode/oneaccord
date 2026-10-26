import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TeamSession } from '@oa/types';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { TokensService } from '../common/tokens.service';
import { MailService } from '../mail/mail.service';
import { magicLinkEmail } from '../mail/templates';

const LINK_MINUTES = 20;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * EV-5: the team signs in by magic link. Nothing in the reply says whether
   * the address is one of ours.
   */
  async sendMagicLink(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    const member = await this.prisma.teamMember.findUnique({ where: { email } });
    if (!member || !member.active) {
      this.logger.warn(`Sign-in asked for an address we do not know.`);
      return;
    }

    const { token, hash } = this.tokens.magicLinkToken();
    await this.prisma.magicLink.create({
      data: {
        teamMemberId: member.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000),
      },
    });

    const event = await this.prisma.event.findFirst({
      where: { status: { in: ['OPEN', 'LIVE', 'CLOSED'] } },
      orderBy: { startsAt: 'asc' },
    });

    await this.mail.enqueue(
      member.email,
      magicLinkEmail({
        fullName: member.fullName,
        role: member.role,
        signInUrl: `${this.apiBase()}/auth/callback?token=${token}`,
        city: event?.city ?? 'Upper Room',
        cityColour: event?.cityColor ?? '#F5C400',
        minutes: LINK_MINUTES,
      }),
    );
  }

  /** One use only, and only inside its twenty minutes. */
  async redeem(token: string): Promise<{ memberId: string; role: string } | null> {
    const hash = this.tokens.hash(token);
    const link = await this.prisma.magicLink.findUnique({
      where: { tokenHash: hash },
      include: { teamMember: true },
    });
    if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) return null;
    if (!link.teamMember.active) return null;

    await this.prisma.magicLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    });
    return { memberId: link.teamMemberId, role: link.teamMember.role };
  }

  async session(memberId: string): Promise<TeamSession | null> {
    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { assignments: true },
    });
    if (!member) return null;

    return {
      id: member.id,
      email: member.email,
      fullName: member.fullName,
      role: member.role,
      eventId: member.assignments[0]?.eventId ?? null,
      pickupPointIds: member.assignments
        .map((assignment) => assignment.pickupPointId)
        .filter((value): value is string => !!value),
      gateIds: member.assignments
        .map((assignment) => assignment.gateId)
        .filter((value): value is string => !!value),
    };
  }

  /** Where to land after signing in: the team screens or the dashboard. */
  homeFor(role: string): string {
    return role === 'ADMIN' || role === 'SUPER_ADMIN' ? this.config.adminUrl : this.config.teamUrl;
  }

  private apiBase(): string {
    return this.config.apiUrl.replace(/\/$/, '');
  }
}
