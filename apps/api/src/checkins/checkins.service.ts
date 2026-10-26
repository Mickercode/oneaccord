import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CheckInResult, CheckInStage, ScanContext, ZoneSummary } from '@oa/types';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { TokensService } from '../common/tokens.service';
import type { PassCookie } from '../common/cookies.service';
import { normalisePassCode } from '../common/pass-code';
import { eventSummary, tripSummary, zoneSummary, TRIP_INCLUDE } from '../common/summaries';
import { LiveService } from '../live/live.service';
import { ZonesService } from '../zones/zones.service';
import { RegistrationsService } from '../registrations/registrations.service';
import type { ScanDto, WalkInDto } from './checkins.dto';

type CheckInMethod = 'DELEGATE_CODE' | 'GATE_POSTER' | 'BY_NAME' | 'TRIP_CONFIRMED' | 'WALK_IN';

@Injectable()
export class CheckInsService {
  private readonly logger = new Logger(CheckInsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly live: LiveService,
    private readonly zones: ZonesService,
    private readonly registrations: RegistrationsService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * What the check-in page needs to ask its one question: which trip or gate
   * this code belongs to, and who this phone is carrying. BD-2.
   */
  async context(token: string, cookie: PassCookie | null): Promise<ScanContext> {
    const payload = this.tokens.verify(token);

    if (payload === 'BAD_TOKEN' || payload === 'EXPIRED') {
      // A dead token still names no event, so answer with the plainest shape.
      const event = await this.prisma.event.findFirst({
        where: { status: { in: ['LIVE', 'OPEN'] } },
        orderBy: { startsAt: 'asc' },
      });
      if (!event) throw new NotFoundException('We cannot read that code.');
      return {
        kind: 'BOARDING',
        valid: false,
        reason: payload,
        event: eventSummary(event),
        trip: null,
        gateName: null,
        attendee: null,
      };
    }

    if (payload.kind === 'g') {
      const gate = await this.prisma.gate.findUnique({
        where: { id: payload.gateId },
        include: { event: true },
      });
      if (!gate) throw new NotFoundException('We cannot find that gate.');
      const outsideHours = !this.withinDoors(gate.event);
      return {
        kind: 'GATE',
        valid: !outsideHours,
        reason: outsideHours ? 'OUTSIDE_HOURS' : undefined,
        event: eventSummary(gate.event),
        trip: null,
        gateName: gate.name,
        attendee: await this.attendeeFromCookie(cookie, gate.eventId, null),
      };
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: payload.tripId },
      include: { ...TRIP_INCLUDE, event: true },
    });
    if (!trip) throw new NotFoundException('We cannot find that trip.');

    const boardedCount = await this.prisma.checkIn.count({
      where: { tripId: trip.id, stage: 'BOARDED' },
    });
    const locked = trip.status === 'DEPARTED' || trip.status === 'ARRIVED';

    return {
      kind: 'BOARDING',
      valid: !locked,
      reason: locked ? 'TRIP_LOCKED' : undefined,
      event: eventSummary(trip.event),
      trip: tripSummary(trip, boardedCount),
      gateName: null,
      attendee: await this.attendeeFromCookie(cookie, trip.eventId, trip.id),
    };
  }

  /** BD-2, BD-3, BD-6, BD-7. */
  async boarding(dto: ScanDto, cookie: PassCookie | null): Promise<CheckInResult> {
    const payload = this.tokens.verify(dto.token);
    if (payload === 'EXPIRED') {
      // BD-4: a screenshot shared in a group chat is worth nothing.
      throw new ForbiddenException({
        statusCode: 403,
        error: 'EXPIRED',
        message: 'That code has expired. Ask your delegate to show it again.',
      });
    }
    if (payload === 'BAD_TOKEN' || payload.kind !== 'b') {
      throw new BadRequestException('We cannot read that code.');
    }

    const trip = await this.prisma.trip.findUnique({
      where: { id: payload.tripId },
      include: {
        ...TRIP_INCLUDE,
        event: true,
        pickupPoint: { select: { name: true, zoneId: true } },
      },
    });
    if (!trip) throw new NotFoundException('We cannot find that trip.');
    if (trip.status === 'DEPARTED' || trip.status === 'ARRIVED') {
      // BD-8: once the delegate marks the trip gone, the count is locked.
      throw new ConflictException({
        statusCode: 409,
        error: 'TRIP_LOCKED',
        message: 'This trip has left. Please speak to your delegate.',
      });
    }

    const registration = await this.identify(trip.eventId, dto, cookie);
    const switchedTrip = !!registration.tripId && registration.tripId !== trip.id;

    // ZN-1: they sit with the bus they actually rode, not the one they booked.
    const zoneId = trip.pickupPoint.zoneId ?? registration.zoneId ?? null;

    const { created, checkIn } = await this.record(registration.id, 'BOARDED', 'DELEGATE_CODE', {
      tripId: trip.id,
      zoneId,
    });

    if (created && registration.zoneId !== zoneId) {
      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { zoneId },
      });
    }

    if (trip.status === 'SCHEDULED') {
      await this.prisma.trip.update({ where: { id: trip.id }, data: { status: 'BOARDING' } });
    }

    this.live.touch(trip.eventId);

    const zone = checkIn.zoneId ? await this.zones.byId(checkIn.zoneId) : null;
    const boardedCount = await this.prisma.checkIn.count({
      where: { tripId: trip.id, stage: 'BOARDED' },
    });

    return {
      alreadyCheckedIn: !created,
      stage: 'BOARDED',
      fullName: registration.fullName,
      passCode: registration.passCode,
      zone,
      delegateFirstName: trip.delegate?.fullName.split(' ')[0] ?? null,
      trip: tripSummary(trip, boardedCount),
      switchedTrip,
    };
  }

  /** GT-2 and GT-3: the printed poster in the security queue. */
  async gate(dto: ScanDto, cookie: PassCookie | null): Promise<CheckInResult> {
    const payload = this.tokens.verify(dto.token);
    if (payload === 'BAD_TOKEN' || payload === 'EXPIRED' || payload.kind !== 'g') {
      throw new BadRequestException('We cannot read that code.');
    }

    const gate = await this.prisma.gate.findUnique({
      where: { id: payload.gateId },
      include: { event: true },
    });
    if (!gate) throw new NotFoundException('We cannot find that gate.');
    if (!this.withinDoors(gate.event)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'OUTSIDE_HOURS',
        message: 'The doors are not open yet.',
      });
    }

    const registration = await this.identify(gate.eventId, dto, cookie);
    const zone = await this.zoneForArrival(registration, gate.eventId);

    const { created } = await this.record(registration.id, 'ARRIVED', 'GATE_POSTER', {
      gateId: gate.id,
      zoneId: zone?.id ?? null,
      tripId: registration.tripId,
    });

    if (created && zone && registration.zoneId !== zone.id) {
      await this.prisma.registration.update({
        where: { id: registration.id },
        data: { zoneId: zone.id },
      });
    }

    this.live.touch(gate.eventId);

    return {
      alreadyCheckedIn: !created,
      stage: 'ARRIVED',
      fullName: registration.fullName,
      passCode: registration.passCode,
      zone,
      delegateFirstName: null,
      trip: registration.tripId ? await this.registrations.tripSummary(registration.tripId) : null,
      switchedTrip: false,
    };
  }

  /** BD-5: no phone, so the delegate does it. */
  async byName(
    tripId: string,
    registrationId: string,
    teamMemberId: string,
  ): Promise<CheckInResult> {
    const [trip, registration] = await Promise.all([
      this.prisma.trip.findUnique({
        where: { id: tripId },
        include: { ...TRIP_INCLUDE, pickupPoint: { select: { name: true, zoneId: true } } },
      }),
      this.prisma.registration.findUnique({ where: { id: registrationId } }),
    ]);
    if (!trip) throw new NotFoundException('We cannot find that trip.');
    if (!registration) throw new NotFoundException('We cannot find that pass.');
    if (registration.eventId !== trip.eventId) {
      throw new BadRequestException('That person is registered for another gathering.');
    }
    if (trip.status === 'DEPARTED' || trip.status === 'ARRIVED') {
      throw new ConflictException('This trip has left. An admin can reopen it.');
    }

    const switchedTrip = !!registration.tripId && registration.tripId !== trip.id;
    const zoneId = trip.pickupPoint.zoneId ?? registration.zoneId ?? null;

    const { created } = await this.record(registration.id, 'BOARDED', 'BY_NAME', {
      tripId: trip.id,
      zoneId,
      confirmedById: teamMemberId,
    });

    if (created && registration.zoneId !== zoneId) {
      await this.prisma.registration.update({ where: { id: registration.id }, data: { zoneId } });
    }
    if (trip.status === 'SCHEDULED') {
      await this.prisma.trip.update({ where: { id: trip.id }, data: { status: 'BOARDING' } });
    }
    this.live.touch(trip.eventId);

    const boardedCount = await this.prisma.checkIn.count({
      where: { tripId: trip.id, stage: 'BOARDED' },
    });

    return {
      alreadyCheckedIn: !created,
      stage: 'BOARDED',
      fullName: registration.fullName,
      passCode: registration.passCode,
      zone: zoneId ? await this.zones.byId(zoneId) : null,
      delegateFirstName: trip.delegate?.fullName.split(' ')[0] ?? null,
      trip: tripSummary(trip, boardedCount),
      switchedTrip,
    };
  }

  /** GT-4: register and check in at once, at the walk-in lane. */
  async walkIn(dto: WalkInDto): Promise<CheckInResult> {
    const payload = this.tokens.verify(dto.token);
    if (payload === 'BAD_TOKEN' || payload === 'EXPIRED' || payload.kind !== 'g') {
      throw new BadRequestException('We cannot read that code.');
    }
    if (!dto.consentData) {
      throw new BadRequestException('We need your permission to store your details.');
    }

    const gate = await this.prisma.gate.findUnique({
      where: { id: payload.gateId },
      include: { event: true },
    });
    if (!gate) throw new NotFoundException('We cannot find that gate.');
    if (!this.withinDoors(gate.event)) {
      throw new ForbiddenException('The doors are not open yet.');
    }

    const zone = await this.zones.zoneWithMostSpace(gate.eventId);
    const registration = await this.registrations.createOnTheSpot({
      eventId: gate.eventId,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone ?? null,
      type: 'WALK_IN',
      zoneId: zone?.id ?? null,
      consentData: dto.consentData,
      consentEmail: dto.consentEmail,
    });

    const { created } = await this.record(registration.id, 'ARRIVED', 'WALK_IN', {
      gateId: gate.id,
      zoneId: zone?.id ?? null,
    });

    await this.registrations.sendPass(registration.id);
    this.live.touch(gate.eventId);

    return {
      alreadyCheckedIn: !created,
      stage: 'ARRIVED',
      fullName: registration.fullName,
      passCode: registration.passCode,
      zone,
      delegateFirstName: null,
      trip: null,
      switchedTrip: false,
    };
  }

  /** GT-1: one tap marks everyone who boarded this trip as arrived. */
  async confirmTripArrival(tripId: string, teamMemberId: string): Promise<{ arrived: number }> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { pickupPoint: { select: { zoneId: true } } },
    });
    if (!trip) throw new NotFoundException('We cannot find that trip.');

    const boarded = await this.prisma.checkIn.findMany({
      where: { tripId, stage: 'BOARDED' },
      select: { registrationId: true, zoneId: true },
    });

    // createMany with skipDuplicates keeps one arrival per person, however
    // many times an usher taps. Data integrity, in the non-functional list.
    const result = await this.prisma.checkIn.createMany({
      data: boarded.map((row) => ({
        registrationId: row.registrationId,
        stage: 'ARRIVED' as const,
        method: 'TRIP_CONFIRMED' as const,
        tripId,
        zoneId: row.zoneId ?? trip.pickupPoint.zoneId ?? null,
        confirmedById: teamMemberId,
      })),
      skipDuplicates: true,
    });

    await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'ARRIVED', arrivedAt: new Date() },
    });
    this.live.touch(trip.eventId);

    return { arrived: result.count };
  }

  /** GT-5: an usher settles a question about one person. */
  async lookUp(eventId: string, query: string) {
    const passCode = normalisePassCode(query);
    const registration = await this.prisma.registration.findFirst({
      where: {
        eventId,
        OR: [
          ...(passCode ? [{ passCode }] : []),
          { email: query.trim().toLowerCase() },
          { fullName: { contains: query.trim(), mode: 'insensitive' as const } },
        ],
      },
      include: {
        zone: true,
        trip: { include: TRIP_INCLUDE },
        checkIns: { select: { stage: true, createdAt: true, method: true } },
      },
    });
    if (!registration) throw new NotFoundException('We cannot find this pass.');
    return registration;
  }

  /**
   * One row per person per stage. The unique index is what makes a scan
   * repeated five times change nothing.
   */
  private async record(
    registrationId: string,
    stage: CheckInStage,
    method: CheckInMethod,
    extra: {
      tripId?: string | null;
      zoneId?: string | null;
      gateId?: string | null;
      confirmedById?: string | null;
    },
  ) {
    try {
      const checkIn = await this.prisma.checkIn.create({
        data: {
          registrationId,
          stage,
          method,
          tripId: extra.tripId ?? null,
          zoneId: extra.zoneId ?? null,
          gateId: extra.gateId ?? null,
          confirmedById: extra.confirmedById ?? null,
        },
      });
      return { created: true, checkIn };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const checkIn = await this.prisma.checkIn.findUniqueOrThrow({
          where: { registrationId_stage: { registrationId, stage } },
        });
        return { created: false, checkIn };
      }
      throw error;
    }
  }

  /** BD-2 and BD-3: the phone that remembers them, or the pass code they type. */
  private async identify(eventId: string, dto: ScanDto, cookie: PassCookie | null) {
    // A typed pass code wins over the phone's cookie: on a borrowed phone it
    // is the only way the right person gets checked in.
    if (dto.passCode) {
      const passCode = normalisePassCode(dto.passCode);
      if (passCode) {
        const found = await this.prisma.registration.findUnique({
          where: { eventId_passCode: { eventId, passCode } },
        });
        if (found) return found;
      }
    }

    if (dto.email) {
      const found = await this.prisma.registration.findUnique({
        where: { eventId_email: { eventId, email: dto.email.trim().toLowerCase() } },
      });
      if (found) return found;
    }

    if (cookie && cookie.eid === eventId) {
      const byCookie = await this.prisma.registration.findUnique({ where: { id: cookie.rid } });
      if (byCookie && byCookie.deviceVersion === cookie.v) return byCookie;
    }

    throw new NotFoundException({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'We cannot find this pass. Please head to the walk-in lane.',
    });
  }

  private async attendeeFromCookie(
    cookie: PassCookie | null,
    eventId: string,
    tripId: string | null,
  ): Promise<ScanContext['attendee']> {
    if (!cookie || cookie.eid !== eventId) return null;
    const registration = await this.prisma.registration.findUnique({ where: { id: cookie.rid } });
    if (!registration || registration.deviceVersion !== cookie.v) return null;
    return {
      fullName: registration.fullName,
      passCode: registration.passCode,
      onThisTrip: tripId ? registration.tripId === tripId : true,
    };
  }

  /** ZN-2: bus riders keep their trip's zone; everyone else gets the emptiest. */
  private async zoneForArrival(
    registration: { zoneId: string | null; type: string },
    eventId: string,
  ): Promise<ZoneSummary | null> {
    if (registration.zoneId) {
      const zone = await this.prisma.zone.findUnique({ where: { id: registration.zoneId } });
      if (zone && !zone.closed) return zoneSummary(zone);
    }
    return this.zones.zoneWithMostSpace(eventId);
  }

  /** GT-3: the poster only works while the doors are open. */
  private withinDoors(event: { doorsOpenAt: Date; doorsCloseAt: Date }): boolean {
    const now = Date.now();
    return now >= event.doorsOpenAt.getTime() && now <= event.doorsCloseAt.getTime();
  }
}
