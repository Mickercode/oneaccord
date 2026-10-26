import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BoardedAttendee, BoardingCodeResponse, TripSummary } from '@oa/types';
import { PrismaService } from '../common/prisma.service';
import { TokensService } from '../common/tokens.service';
import { tripSummary, TRIP_INCLUDE } from '../common/summaries';
import { worksAtPickupPoint, type TeamPrincipal } from '../common/team.guard';
import { LiveService } from '../live/live.service';
import { CheckInsService } from '../checkins/checkins.service';
import { RegistrationsService } from '../registrations/registrations.service';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly live: LiveService,
    private readonly checkIns: CheckInsService,
    private readonly registrations: RegistrationsService,
  ) {}

  /** BD-1: the code on the delegate's phone, and the count beside it. */
  async boardingCode(tripId: string, team: TeamPrincipal): Promise<BoardingCodeResponse> {
    const trip = await this.mine(tripId, team);
    if (trip.status === 'DEPARTED' || trip.status === 'ARRIVED') {
      throw new ConflictException('This trip has left. An admin can reopen it.');
    }

    const boardedCount = await this.prisma.checkIn.count({
      where: { tripId, stage: 'BOARDED' },
    });

    return {
      token: this.tokens.boardingToken(tripId),
      url: this.tokens.boardingUrl(tripId),
      rotatesAt: this.tokens.windowEndsAt(),
      trip: tripSummary(trip, boardedCount),
      boardedCount,
    };
  }

  /** BD-1: who has boarded, newest first, for the delegate's list. */
  async boarded(tripId: string, team: TeamPrincipal): Promise<BoardedAttendee[]> {
    await this.mine(tripId, team);
    const rows = await this.prisma.checkIn.findMany({
      where: { tripId, stage: 'BOARDED' },
      orderBy: { createdAt: 'desc' },
      include: {
        registration: { select: { id: true, fullName: true, passCode: true } },
        zone: { select: { letter: true } },
      },
    });
    return rows.map((row) => ({
      registrationId: row.registration.id,
      fullName: row.registration.fullName,
      passCode: row.registration.passCode,
      zoneLetter: row.zone?.letter ?? null,
      boardedAt: row.createdAt.toISOString(),
      method: row.method,
    }));
  }

  /** Everyone expected on this trip, so the delegate can check in by name. */
  async manifest(tripId: string, team: TeamPrincipal) {
    await this.mine(tripId, team);
    const rows = await this.prisma.registration.findMany({
      where: { tripId },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        passCode: true,
        phone: true,
        zone: { select: { letter: true } },
        checkIns: { select: { stage: true } },
      },
    });
    return rows.map((row) => ({
      registrationId: row.id,
      fullName: row.fullName,
      passCode: row.passCode,
      phone: row.phone,
      zoneLetter: row.zone?.letter ?? null,
      boarded: row.checkIns.some((checkIn) => checkIn.stage === 'BOARDED'),
    }));
  }

  /** BD-5: a walk-in added to the bus, if there is a seat. */
  async addWalkIn(
    tripId: string,
    team: TeamPrincipal,
    input: { fullName: string; email: string; phone?: string },
  ) {
    const trip = await this.mine(tripId, team);
    if (trip.status === 'DEPARTED' || trip.status === 'ARRIVED') {
      throw new ConflictException('This trip has left.');
    }

    const taken = await this.prisma.registration.count({ where: { tripId } });
    if (taken >= trip.capacity) {
      throw new ConflictException('This bus is full.');
    }

    const point = await this.prisma.pickupPoint.findUnique({
      where: { id: trip.pickupPointId },
      select: { id: true, kind: true, zoneId: true },
    });

    const registration = await this.registrations.createOnTheSpot({
      eventId: trip.eventId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      type: point?.kind === 'AREA' ? 'AREA' : 'CAMPUS',
      tripId,
      pickupPointId: point?.id ?? null,
      zoneId: point?.zoneId ?? null,
      consentData: true,
      consentEmail: true,
    });

    const result = await this.checkIns.byName(tripId, registration.id, team.id);
    await this.registrations.sendPass(registration.id);
    return result;
  }

  /** BD-8: the delegate marks the trip gone and the count is locked. */
  async depart(tripId: string, team: TeamPrincipal): Promise<TripSummary> {
    const trip = await this.mine(tripId, team);
    if (trip.status === 'DEPARTED' || trip.status === 'ARRIVED') {
      throw new ConflictException('This trip has already left.');
    }
    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'DEPARTED', departedAt: new Date() },
      include: TRIP_INCLUDE,
    });
    this.live.touch(trip.eventId);
    const boardedCount = await this.prisma.checkIn.count({ where: { tripId, stage: 'BOARDED' } });
    return tripSummary(updated, boardedCount);
  }

  /** BD-8: only an admin can reopen a locked trip. */
  async reopen(tripId: string): Promise<TripSummary> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('We cannot find that trip.');
    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'BOARDING', departedAt: null, arrivedAt: null },
      include: TRIP_INCLUDE,
    });
    this.live.touch(trip.eventId);
    const boardedCount = await this.prisma.checkIn.count({ where: { tripId, stage: 'BOARDED' } });
    return tripSummary(updated, boardedCount);
  }

  /** GT-1: the usher's one tap when the bus pulls in. */
  async confirmArrival(tripId: string, team: TeamPrincipal): Promise<{ arrived: number }> {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('We cannot find that trip.');
    if (team.role === 'DELEGATE') {
      throw new ForbiddenException('Arrivals are confirmed at the gate.');
    }
    return this.checkIns.confirmTripArrival(tripId, team.id);
  }

  /** GT-1: trips on the way and arrived, for the gate screen. */
  async list(eventId: string, status?: string): Promise<TripSummary[]> {
    const statuses = status
      ? status
          .split(',')
          .filter((value) => ['SCHEDULED', 'BOARDING', 'DEPARTED', 'ARRIVED'].includes(value))
      : undefined;

    const trips = await this.prisma.trip.findMany({
      where: { eventId, ...(statuses?.length ? { status: { in: statuses as never } } : {}) },
      orderBy: [{ departedAt: 'asc' }, { departsAt: 'asc' }],
      include: TRIP_INCLUDE,
    });

    const counts = await this.prisma.checkIn.groupBy({
      by: ['tripId'],
      where: { stage: 'BOARDED', trip: { eventId } },
      _count: { _all: true },
    });
    const boardedBy = new Map(counts.map((row) => [row.tripId ?? '', row._count._all]));

    return trips.map((trip) => tripSummary(trip, boardedBy.get(trip.id) ?? 0));
  }

  /** The trips this delegate is posted to today. */
  async forDelegate(team: TeamPrincipal): Promise<TripSummary[]> {
    const trips = await this.prisma.trip.findMany({
      where: {
        OR: [
          { delegateId: team.id },
          ...(team.pickupPointIds.length ? [{ pickupPointId: { in: team.pickupPointIds } }] : []),
        ],
        event: { status: { in: ['OPEN', 'CLOSED', 'LIVE'] } },
      },
      orderBy: { departsAt: 'asc' },
      include: TRIP_INCLUDE,
    });
    if (trips.length === 0) return [];

    const counts = await this.prisma.checkIn.groupBy({
      by: ['tripId'],
      where: { stage: 'BOARDED', tripId: { in: trips.map((trip) => trip.id) } },
      _count: { _all: true },
    });
    const boardedBy = new Map(counts.map((row) => [row.tripId ?? '', row._count._all]));
    return trips.map((trip) => tripSummary(trip, boardedBy.get(trip.id) ?? 0));
  }

  /** A delegate may only work their own pickup point. */
  private async mine(tripId: string, team: TeamPrincipal) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: TRIP_INCLUDE,
    });
    if (!trip) throw new NotFoundException('We cannot find that trip.');
    const allowed = trip.delegateId === team.id || worksAtPickupPoint(team, trip.pickupPointId);
    if (!allowed) throw new ForbiddenException('That trip belongs to another pickup point.');
    return trip;
  }
}
