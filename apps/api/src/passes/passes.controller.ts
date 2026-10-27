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
import { SessionsService } from '../common/sessions.service';
import { normalisePassCode } from '../common/pass-code';
import { eventSummary, tripSummary, zoneSummary, TRIP_INCLUDE } from '../common/summaries';

@ApiTags('passes')
@Controller('passes')
export class PassesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
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
    this.sessions.setPass(res, {
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
    // Sets the cookie and hands back the same session as a bearer token, so
    // the app works whether or not it shares a site with this API.
    const deviceToken = this.sessions.setPass(res, {
      rid: registration.id,
      eid: registration.eventId,
      code: registration.passCode,
      v: registration.deviceVersion,
    });
    return { ...view, deviceToken };
  }

  /** Whoever this phone is carrying, for the check-in page. */
  @Get('me/current')
  async me(@Req() req: Request): Promise<PassView> {
    const carried = this.sessions.readPass(req);
    if (!carried) throw new UnauthorizedException('This phone is not carrying a UR Pass.');
    const { registration, view } = await this.load(carried.code, carried.eid);
    return {
      ...view,
      deviceToken: this.sessions.issuePass({
        rid: registration.id,
        eid: registration.eventId,
        code: registration.passCode,
        v: registration.deviceVersion,
      }),
    };
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

    // The device token belongs to the caller: only the endpoints that
    // issue a session attach one.
    const view: Omit<PassView, 'deviceToken'> = {
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
