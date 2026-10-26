import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { PassView } from '@oa/types';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { CookiesService } from '../common/cookies.service';
import { normalisePassCode } from '../common/pass-code';
import { eventSummary, tripSummary, zoneSummary, TRIP_INCLUDE } from '../common/summaries';

@ApiTags('passes')
@Controller('passes')
export class PassesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cookies: CookiesService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * PS-2: the link in the email. It sets the device cookie and hands the
   * attendee to the pass page, so the phone is remembered for check-in.
   */
  @Get(':code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async open(@Param('code') code: string, @Res() res: Response): Promise<void> {
    const { registration } = await this.load(code);
    this.cookies.setPass(res, {
      rid: registration.id,
      eid: registration.eventId,
      code: registration.passCode,
      v: registration.deviceVersion,
    });
    res.redirect(`${this.config.webUrl.replace(/\/$/, '')}/pass/${registration.passCode}`);
  }

  /** The JSON the pass page renders, and it refreshes the cookie on the way. */
  @Get(':code/view')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async view(
    @Param('code') code: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PassView> {
    const { registration, view } = await this.load(code);
    this.cookies.setPass(res, {
      rid: registration.id,
      eid: registration.eventId,
      code: registration.passCode,
      v: registration.deviceVersion,
    });
    return view;
  }

  /** Whoever this phone is carrying, for the check-in page. */
  @Get('me/current')
  async me(@Req() req: Request): Promise<PassView> {
    const cookie = this.cookies.readPass(req);
    if (!cookie) throw new UnauthorizedException('This phone is not carrying a UR Pass.');
    const { view } = await this.load(cookie.code, cookie.eid);
    return view;
  }

  private async load(rawCode: string, eventId?: string) {
    const passCode = normalisePassCode(rawCode);
    if (!passCode) throw new NotFoundException('We cannot find this pass.');

    const registration = await this.prisma.registration.findFirst({
      where: { passCode, ...(eventId ? { eventId } : {}) },
      include: {
        event: true,
        pickupPoint: true,
        zone: true,
        trip: { include: TRIP_INCLUDE },
        checkIns: { select: { stage: true } },
      },
    });
    if (!registration) throw new NotFoundException('We cannot find this pass.');

    const boardedCount = registration.tripId
      ? await this.prisma.checkIn.count({
          where: { tripId: registration.tripId, stage: 'BOARDED' },
        })
      : 0;

    const view: PassView = {
      passCode: registration.passCode,
      fullName: registration.fullName,
      type: registration.type,
      event: eventSummary(registration.event),
      trip: registration.trip ? tripSummary(registration.trip, boardedCount) : null,
      pickupPoint: registration.pickupPoint
        ? {
            name: registration.pickupPoint.name,
            address: registration.pickupPoint.address,
            departsAt: registration.pickupPoint.departsAt.toISOString(),
          }
        : null,
      zone: registration.zone ? zoneSummary(registration.zone) : null,
      delegateFirstName: registration.trip?.delegate?.fullName.split(' ')[0] ?? null,
      whatsappUrl: registration.trip?.whatsappUrl ?? null,
      checkedIn: {
        boarded: registration.checkIns.some((c) => c.stage === 'BOARDED'),
        arrived: registration.checkIns.some((c) => c.stage === 'ARRIVED'),
      },
    };

    return { registration, view };
  }
}
