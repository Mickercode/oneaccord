import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TeamSession } from '@oa/types';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { TokensService } from '../common/tokens.service';
import { MailService } from '../mail/mail.service';
import { magicLinkEmail } from '../mail/templates';
import { describePasswordProblem, hashPassword, verifyPassword } from '../common/password';

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

  /**
   * EV-5 keeps the magic link for people who were invited. This is the other
   * way in, for the standing accounts that sign in every event.
   *
   * The same answer whether the address is unknown, the member is inactive or
   * the password is simply wrong: anything else lets someone work out which
   * addresses are team accounts.
   */
  async signInWithPassword(
    rawEmail: string,
    password: string,
  ): Promise<{ memberId: string; role: string } | null> {
    const email = rawEmail.trim().toLowerCase();
    const member = await this.prisma.teamMember.findUnique({ where: { email } });

    if (!member || !member.active || !member.passwordHash) {
      // Still spend the time hashing, so a missing account does not answer
      // noticeably faster than a wrong password.
      await verifyPassword(password, null);
      this.logger.warn('A sign-in was refused.');
      return null;
    }

    if (!(await verifyPassword(password, member.passwordHash))) {
      this.logger.warn(`A sign-in was refused for ${member.email}.`);
      return null;
    }

    return { memberId: member.id, role: member.role };
  }

  /** Anyone signed in can set or change their own password. */
  async setPassword(memberId: string, password: string): Promise<string | null> {
    const problem = describePasswordProblem(password);
    if (problem) return problem;

    await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { passwordHash: await hashPassword(password) },
    });
    this.logger.log('A team member set their password.');
    return null;
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
