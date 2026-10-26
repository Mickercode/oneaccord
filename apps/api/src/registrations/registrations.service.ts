import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Registration } from '@prisma/client';
import type { RegisterResponse, TripSummary } from '@oa/types';
import { AppConfig, CONFIG } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { TRIP_INCLUDE, tripSummary as toTripSummary, zoneSummary } from '../common/summaries';
import { newPassCode, normaliseEmail } from '../common/pass-code';
import { MailService } from '../mail/mail.service';
import { passEmail } from '../mail/templates';
import { MAIL_INCLUDE, passContext, unsubscribeToken } from '../mail/pass-context';
import { LiveService } from '../live/live.service';
import type { RegisterDto } from './registrations.dto';

const PASS_CODE_TRIES = 8;

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly live: LiveService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** RG-1 to RG-5, then PS-1. */
  async register(eventId: string, dto: RegisterDto): Promise<RegisterResponse> {
    if (!dto.consentData) {
      throw new BadRequestException('We need your permission to store your details.');
    }

    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('We cannot find that event.');
    if (event.status !== 'OPEN' && event.status !== 'LIVE') {
      throw new ConflictException('Registration for this gathering is closed.');
    }

    const email = normaliseEmail(dto.email);

    // RG-3: registering again resends the pass rather than making a second person.
    const existing = await this.prisma.registration.findUnique({
      where: { eventId_email: { eventId, email } },
      include: MAIL_INCLUDE,
    });
    if (existing) {
      await this.sendPass(existing.id);
      return await this.toResponse(existing, true);
    }

    let pickupPointId: string | null = null;
    let tripId: string | null = null;
    let zoneId: string | null = null;

    if (dto.type === 'CAMPUS' || dto.type === 'AREA') {
      if (!dto.pickupPointId) {
        throw new BadRequestException('Please choose where you are coming from.');
      }
      const point = await this.prisma.pickupPoint.findFirst({
        where: { id: dto.pickupPointId, eventId },
      });
      if (!point) throw new NotFoundException('We cannot find that pickup point.');
      if (point.kind !== dto.type) {
        throw new BadRequestException('That pickup point is not of that kind.');
      }
      pickupPointId = point.id;
      zoneId = point.zoneId; // ZN-1: a whole bus sits together.
    }

    const created = await this.createWithPassCode(async (passCode, tx) => {
      if (pickupPointId) {
        const trip = await this.firstTripWithSeats(tx, pickupPointId);
        if (!trip) {
          throw new ConflictException({
            statusCode: 409,
            error: 'PICKUP_FULL',
            message: 'Every trip from that pickup point is full.',
          });
        }
        tripId = trip.id;
      }
      return tx.registration.create({
        data: {
          eventId,
          fullName: dto.fullName,
          email,
          phone: dto.phone ?? null,
          type: dto.type,
          pickupPointId,
          tripId,
          zoneId,
          passCode,
          consentData: dto.consentData,
          consentEmail: dto.consentEmail,
        },
        include: MAIL_INCLUDE,
      });
    });

    await this.sendPass(created.id);
    this.live.touch(eventId);
    return await this.toResponse(created, false);
  }

  /** BD-5 and GT-4: someone who never registered, added on the spot. */
  async createOnTheSpot(input: {
    eventId: string;
    fullName: string;
    email: string;
    phone?: string | null;
    type: 'WALK_IN' | 'CAMPUS' | 'AREA';
    tripId?: string | null;
    pickupPointId?: string | null;
    zoneId?: string | null;
    consentData: boolean;
    consentEmail: boolean;
  }) {
    const email = normaliseEmail(input.email);
    const existing = await this.prisma.registration.findUnique({
      where: { eventId_email: { eventId: input.eventId, email } },
      include: MAIL_INCLUDE,
    });
    if (existing) return existing;

    return this.createWithPassCode((passCode, tx) =>
      tx.registration.create({
        data: {
          eventId: input.eventId,
          fullName: input.fullName,
          email,
          phone: input.phone ?? null,
          type: input.type,
          tripId: input.tripId ?? null,
          pickupPointId: input.pickupPointId ?? null,
          zoneId: input.zoneId ?? null,
          passCode,
          consentData: input.consentData,
          consentEmail: input.consentEmail,
        },
        include: MAIL_INCLUDE,
      }),
    );
  }

  /** PS-1 and RG-3: send, or send again. */
  async sendPass(registrationId: string): Promise<void> {
    const registration = await this.prisma.registration.findUnique({
      where: { id: registrationId },
      include: MAIL_INCLUDE,
    });
    if (!registration) return;
    await this.mail.enqueue(registration.email, passEmail(passContext(registration, this.config)));
  }

  /** BD-3 and BD-5: find one person by pass code or email. */
  async findByCodeOrEmail(
    eventId: string,
    input: { passCode?: string | null; email?: string | null },
  ) {
    if (input.passCode) {
      return this.prisma.registration.findUnique({
        where: { eventId_passCode: { eventId, passCode: input.passCode } },
        include: MAIL_INCLUDE,
      });
    }
    if (input.email) {
      return this.prisma.registration.findUnique({
        where: { eventId_email: { eventId, email: normaliseEmail(input.email) } },
        include: MAIL_INCLUDE,
      });
    }
    return null;
  }

  /** BD-5: the delegate searches a name. Their own trip first, then the rest. */
  async searchByName(eventId: string, query: string, tripId?: string) {
    const term = query.trim();
    if (term.length < 2) return [];
    const rows = await this.prisma.registration.findMany({
      where: {
        eventId,
        OR: [
          { fullName: { contains: term, mode: 'insensitive' } },
          { passCode: { contains: term.toUpperCase() } },
        ],
      },
      include: {
        trip: { select: { id: true, code: true } },
        zone: { select: { letter: true } },
        checkIns: { select: { stage: true } },
      },
      orderBy: { fullName: 'asc' },
      take: 25,
    });
    if (!tripId) return rows;
    return [...rows].sort((a, b) => {
      const aMine = a.tripId === tripId ? 0 : 1;
      const bMine = b.tripId === tripId ? 0 : 1;
      return aMine - bMine || a.fullName.localeCompare(b.fullName);
    });
  }

  /** MS-2 */
  async unsubscribe(registrationId: string, token: string): Promise<boolean> {
    if (token !== unsubscribeToken(registrationId, this.config.secret)) return false;
    await this.prisma.registration.update({
      where: { id: registrationId },
      data: { unsubscribed: true, consentEmail: false },
    });
    return true;
  }

  /**
   * The Nigeria Data Protection Act 2023 gives an attendee the right to have
   * their details removed. The personal fields go; the check-in rows stay, with
   * nothing personal left on them, so the city's attendance count still adds up.
   * Proof is the pass code plus the email it was sent to.
   */
  async forget(passCode: string, email: string): Promise<boolean> {
    const registration = await this.prisma.registration.findFirst({
      where: { passCode, email: normaliseEmail(email) },
    });
    if (!registration) return false;

    await this.prisma.registration.update({
      where: { id: registration.id },
      data: {
        fullName: 'Removed at their request',
        // Keeps the one-per-event rule without keeping the address.
        email: `removed+${registration.id}@invalid.local`,
        phone: null,
        consentEmail: false,
        unsubscribed: true,
        // Retires any UR Pass cookie already sitting on a phone.
        deviceVersion: { increment: 1 },
      },
    });
    await this.prisma.reminderLog.deleteMany({ where: { registrationId: registration.id } });

    this.logger.log(`Removed the details of one attendee at their request.`);
    return true;
  }

  /** RG-5: what to offer when a pickup point has no seats left. */
  async alternatives(eventId: string, excludePickupPointId: string) {
    const points = await this.prisma.pickupPoint.findMany({
      where: { eventId, id: { not: excludePickupPointId } },
      include: { trips: { select: { id: true, capacity: true } } },
      orderBy: { name: 'asc' },
    });
    const counts = await this.prisma.registration.groupBy({
      by: ['tripId'],
      where: { eventId },
      _count: { _all: true },
    });
    const taken = new Map(counts.map((row) => [row.tripId ?? '', row._count._all]));
    return points
      .map((point) => ({
        id: point.id,
        name: point.name,
        address: point.address,
        seatsLeft: point.trips.reduce(
          (sum, trip) => sum + Math.max(0, trip.capacity - (taken.get(trip.id) ?? 0)),
          0,
        ),
      }))
      .filter((point) => point.seatsLeft > 0);
  }

  /** RG-2: the first trip from this point that still has a seat. */
  private async firstTripWithSeats(tx: Prisma.TransactionClient, pickupPointId: string) {
    // Serialise this pickup point so two registrations cannot take one seat.
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', pickupPointId);

    const trips = await tx.trip.findMany({
      where: { pickupPointId, status: { in: ['SCHEDULED', 'BOARDING'] } },
      orderBy: [{ departsAt: 'asc' }, { code: 'asc' }],
    });
    for (const trip of trips) {
      const taken = await tx.registration.count({ where: { tripId: trip.id } });
      if (taken < trip.capacity) return trip;
    }
    return null;
  }

  /** PS-3: retry the rare pass-code collision instead of failing the attendee. */
  private async createWithPassCode<T>(
    create: (passCode: string, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= PASS_CODE_TRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction((tx) => create(newPassCode(), tx));
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          String(error.meta?.target ?? '').includes('passCode') &&
          attempt < PASS_CODE_TRIES
        ) {
          this.logger.warn(`Pass code collision, retrying (${attempt}).`);
          continue;
        }
        throw error;
      }
    }
    throw new ConflictException('We could not make a pass code. Please try again.');
  }

  private async toResponse(registration: Registration, resent: boolean): Promise<RegisterResponse> {
    const [trip, zone] = await Promise.all([
      registration.tripId ? this.tripSummary(registration.tripId) : Promise.resolve(null),
      registration.zoneId
        ? this.prisma.zone.findUnique({ where: { id: registration.zoneId } })
        : Promise.resolve(null),
    ]);

    return {
      passCode: registration.passCode,
      resent,
      trip,
      zone: zone ? zoneSummary(zone) : null,
      pickupPointName: trip?.pickupPointName ?? null,
    };
  }

  /** One trip, with the live boarded count the attendee screens show. */
  async tripSummary(tripId: string): Promise<TripSummary | null> {
    const [trip, boardedCount] = await Promise.all([
      this.prisma.trip.findUnique({ where: { id: tripId }, include: TRIP_INCLUDE }),
      this.prisma.checkIn.count({ where: { tripId, stage: 'BOARDED' } }),
    ]);
    return trip ? toTripSummary(trip, boardedCount) : null;
  }
}
