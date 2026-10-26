import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { EventSummary, PickupPointSummary } from '@oa/types';
import { PrismaService } from '../common/prisma.service';
import { TokensService } from '../common/tokens.service';
import { eventSummary, zoneSummary } from '../common/summaries';
import { AuthService } from '../auth/auth.service';
import type {
  BusDto,
  CreateEventDto,
  DuplicateEventDto,
  GateDto,
  ImportDto,
  InviteDto,
  PickupPointDto,
  TripDto,
  UpdateEventDto,
  ZoneDto,
} from './events.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
    private readonly auth: AuthService,
  ) {}

  /** EV-1 */
  async create(dto: CreateEventDto): Promise<EventSummary> {
    const event = await this.prisma.event.create({
      data: {
        slug: dto.slug,
        city: dto.city,
        venue: dto.venue,
        address: dto.address ?? null,
        startsAt: new Date(dto.startsAt),
        doorsOpenAt: new Date(dto.doorsOpenAt),
        doorsCloseAt: new Date(dto.doorsCloseAt),
        timezone: dto.timezone ?? 'Africa/Lagos',
        cityColor: dto.cityColor ?? '#F5C400',
        privacyUrl: dto.privacyUrl ?? null,
      },
    });
    return eventSummary(event);
  }

  async update(eventId: string, dto: UpdateEventDto): Promise<EventSummary> {
    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        slug: dto.slug,
        city: dto.city,
        venue: dto.venue,
        address: dto.address ?? null,
        startsAt: new Date(dto.startsAt),
        doorsOpenAt: new Date(dto.doorsOpenAt),
        doorsCloseAt: new Date(dto.doorsCloseAt),
        timezone: dto.timezone ?? undefined,
        cityColor: dto.cityColor ?? undefined,
        privacyUrl: dto.privacyUrl ?? null,
        status: dto.status ?? undefined,
      },
    });
    return eventSummary(event);
  }

  async list(): Promise<EventSummary[]> {
    const events = await this.prisma.event.findMany({ orderBy: { startsAt: 'desc' } });
    return events.map(eventSummary);
  }

  /** The registration page reads this one, by slug or id. */
  async publicView(idOrSlug: string) {
    const event = await this.prisma.event.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { zones: { orderBy: { letter: 'asc' } } },
    });
    if (!event) throw new NotFoundException('We cannot find that gathering.');
    return {
      event: eventSummary(event),
      zones: event.zones.map(zoneSummary),
      pickupPoints: await this.pickupPoints(event.id),
    };
  }

  /** RG-2 and RG-5: what is left at each pickup point. */
  async pickupPoints(eventId: string): Promise<PickupPointSummary[]> {
    const points = await this.prisma.pickupPoint.findMany({
      where: { eventId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      include: {
        zone: true,
        trips: {
          where: { status: { in: ['SCHEDULED', 'BOARDING'] } },
          select: { id: true, capacity: true },
        },
      },
    });
    if (points.length === 0) return [];

    const counts = await this.prisma.registration.groupBy({
      by: ['tripId'],
      where: { eventId },
      _count: { _all: true },
    });
    const taken = new Map(counts.map((row) => [row.tripId ?? '', row._count._all]));

    return points.map((point) => {
      const seatsLeft = point.trips.reduce(
        (sum, trip) => sum + Math.max(0, trip.capacity - (taken.get(trip.id) ?? 0)),
        0,
      );
      return {
        id: point.id,
        kind: point.kind,
        name: point.name,
        address: point.address,
        departsAt: point.departsAt.toISOString(),
        zone: point.zone ? zoneSummary(point.zone) : null,
        hasSeats: seatsLeft > 0,
        seatsLeft,
      };
    });
  }

  /** EV-4 */
  async addZone(eventId: string, dto: ZoneDto) {
    return this.prisma.zone.create({
      data: {
        eventId,
        letter: dto.letter.toUpperCase(),
        name: dto.name,
        color: dto.color,
        capacity: dto.capacity,
      },
    });
  }

  /** EV-2 */
  async addPickupPoint(eventId: string, dto: PickupPointDto) {
    return this.prisma.pickupPoint.create({
      data: {
        eventId,
        kind: dto.kind,
        name: dto.name,
        address: dto.address,
        departsAt: new Date(dto.departsAt),
        zoneId: dto.zoneId ?? null,
      },
    });
  }

  /** EV-3 */
  async addBus(eventId: string, dto: BusDto) {
    return this.prisma.bus.create({
      data: { eventId, code: dto.code, capacity: dto.capacity, plate: dto.plate ?? null },
    });
  }

  async buses(eventId: string) {
    return this.prisma.bus.findMany({ where: { eventId }, orderBy: { code: 'asc' } });
  }

  async addTrip(eventId: string, dto: TripDto) {
    const [bus, point] = await Promise.all([
      this.prisma.bus.findFirst({ where: { id: dto.busId, eventId } }),
      this.prisma.pickupPoint.findFirst({ where: { id: dto.pickupPointId, eventId } }),
    ]);
    if (!bus) throw new NotFoundException('We cannot find that bus.');
    if (!point) throw new NotFoundException('We cannot find that pickup point.');

    return this.prisma.trip.create({
      data: {
        eventId,
        busId: bus.id,
        pickupPointId: point.id,
        code: dto.code,
        capacity: dto.capacity,
        departsAt: new Date(dto.departsAt),
        delegateId: dto.delegateId ?? null,
        whatsappUrl: dto.whatsappUrl ?? null,
      },
    });
  }

  /** GT-2: a gate, and the poster code that belongs to it. */
  async addGate(eventId: string, dto: GateDto) {
    const gate = await this.prisma.gate.create({ data: { eventId, name: dto.name } });
    return { ...gate, posterUrl: this.tokens.gateUrl(gate.id) };
  }

  async gates(eventId: string) {
    const gates = await this.prisma.gate.findMany({ where: { eventId }, orderBy: { name: 'asc' } });
    return gates.map((gate) => ({ ...gate, posterUrl: this.tokens.gateUrl(gate.id) }));
  }

  /** EV-5 */
  async invite(eventId: string, dto: InviteDto) {
    const email = dto.email.trim().toLowerCase();
    const member = await this.prisma.teamMember.upsert({
      where: { email },
      update: { fullName: dto.fullName, role: dto.role, active: true },
      create: { email, fullName: dto.fullName, role: dto.role },
    });

    if (dto.pickupPointId || dto.gateId) {
      await this.assign(member.id, eventId, dto.pickupPointId ?? null, dto.gateId ?? null);
    }

    if (dto.sendEmail !== false) await this.auth.sendMagicLink(email);
    return member;
  }

  /**
   * Postgres treats NULLs in a unique index as distinct, so an upsert on
   * (member, event, point, gate) would happily make a second row. Look first.
   */
  private async assign(
    teamMemberId: string,
    eventId: string,
    pickupPointId: string | null,
    gateId: string | null,
  ) {
    const existing = await this.prisma.assignment.findFirst({
      where: { teamMemberId, eventId, pickupPointId, gateId },
    });
    if (existing) return existing;
    return this.prisma.assignment.create({
      data: { teamMemberId, eventId, pickupPointId, gateId },
    });
  }

  async team(eventId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { eventId },
      include: { teamMember: true, pickupPoint: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return assignments.map((assignment) => ({
      id: assignment.teamMember.id,
      email: assignment.teamMember.email,
      fullName: assignment.teamMember.fullName,
      role: assignment.teamMember.role,
      pickupPointName: assignment.pickupPoint?.name ?? null,
      gateId: assignment.gateId,
    }));
  }

  /** EV-6: copy a city's setup to a new date or a new city. */
  async duplicate(eventId: string, dto: DuplicateEventDto): Promise<EventSummary> {
    const source = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { zones: true, pickupPoints: true, buses: true, trips: true, gates: true },
    });
    if (!source) throw new NotFoundException('We cannot find that event.');

    // Keep the old departure times' offset from the old start time.
    const shift = new Date(dto.startsAt).getTime() - source.startsAt.getTime();
    const moved = (at: Date) => new Date(at.getTime() + shift);

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          slug: dto.slug,
          city: dto.city,
          venue: dto.venue,
          address: source.address,
          startsAt: new Date(dto.startsAt),
          doorsOpenAt: new Date(dto.doorsOpenAt),
          doorsCloseAt: new Date(dto.doorsCloseAt),
          timezone: source.timezone,
          cityColor: dto.cityColor ?? source.cityColor,
          privacyUrl: source.privacyUrl,
          status: 'DRAFT',
        },
      });

      const zoneIds = new Map<string, string>();
      for (const zone of source.zones) {
        const copy = await tx.zone.create({
          data: {
            eventId: event.id,
            letter: zone.letter,
            name: zone.name,
            color: zone.color,
            capacity: zone.capacity,
          },
        });
        zoneIds.set(zone.id, copy.id);
      }

      const pointIds = new Map<string, string>();
      for (const point of source.pickupPoints) {
        const copy = await tx.pickupPoint.create({
          data: {
            eventId: event.id,
            kind: point.kind,
            name: point.name,
            address: point.address,
            departsAt: moved(point.departsAt),
            zoneId: point.zoneId ? (zoneIds.get(point.zoneId) ?? null) : null,
          },
        });
        pointIds.set(point.id, copy.id);
      }

      const busIds = new Map<string, string>();
      for (const bus of source.buses) {
        const copy = await tx.bus.create({
          data: { eventId: event.id, code: bus.code, capacity: bus.capacity, plate: bus.plate },
        });
        busIds.set(bus.id, copy.id);
      }

      for (const trip of source.trips) {
        const busId = busIds.get(trip.busId);
        const pickupPointId = pointIds.get(trip.pickupPointId);
        if (!busId || !pickupPointId) continue;
        await tx.trip.create({
          data: {
            eventId: event.id,
            busId,
            pickupPointId,
            code: trip.code,
            capacity: trip.capacity,
            departsAt: moved(trip.departsAt),
            delegateId: trip.delegateId,
          },
        });
      }

      for (const gate of source.gates) {
        await tx.gate.create({ data: { eventId: event.id, name: gate.name } });
      }

      return eventSummary(event);
    });
  }

  /**
   * EV-7: one CSV row describes a pickup point and, where given, its bus,
   * trip and delegate. Rows repeat the pickup point when a point has several
   * trips; everything is matched by name, so re-importing updates.
   */
  async importSetup(eventId: string, dto: ImportDto) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { zones: true },
    });
    if (!event) throw new NotFoundException('We cannot find that event.');

    const zoneByLetter = new Map(event.zones.map((zone) => [zone.letter.toUpperCase(), zone.id]));
    const summary = { pickupPoints: 0, buses: 0, trips: 0, delegates: 0, skipped: [] as string[] };

    for (const [index, row] of dto.rows.entries()) {
      const line = index + 2; // The header is line 1.
      const zoneId = row.zoneLetter ? zoneByLetter.get(row.zoneLetter.toUpperCase()) : undefined;
      if (row.zoneLetter && !zoneId) {
        summary.skipped.push(`Line ${line}: no zone ${row.zoneLetter}`);
        continue;
      }

      const point = await this.prisma.pickupPoint.upsert({
        where: { eventId_name: { eventId, name: row.pickupPoint } },
        update: {
          address: row.address,
          departsAt: new Date(row.departsAt),
          zoneId: zoneId ?? null,
        },
        create: {
          eventId,
          kind: row.kind,
          name: row.pickupPoint,
          address: row.address,
          departsAt: new Date(row.departsAt),
          zoneId: zoneId ?? null,
        },
      });
      summary.pickupPoints += 1;

      let delegateId: string | null = null;
      if (row.delegateEmail) {
        const delegate = await this.prisma.teamMember.upsert({
          where: { email: row.delegateEmail.toLowerCase() },
          update: { fullName: row.delegateName ?? undefined },
          create: {
            email: row.delegateEmail.toLowerCase(),
            fullName: row.delegateName ?? row.delegateEmail,
            role: 'DELEGATE',
          },
        });
        delegateId = delegate.id;
        summary.delegates += 1;
        await this.assign(delegate.id, eventId, point.id, null);
      }

      if (!row.busCode || !row.capacity) continue;

      const bus = await this.prisma.bus.upsert({
        where: { eventId_code: { eventId, code: row.busCode } },
        update: { capacity: row.capacity },
        create: { eventId, code: row.busCode, capacity: row.capacity },
      });
      summary.buses += 1;

      const tripCode = row.tripCode ?? `${row.busCode}A`;
      await this.prisma.trip.upsert({
        where: { eventId_code: { eventId, code: tripCode } },
        update: {
          busId: bus.id,
          pickupPointId: point.id,
          capacity: row.capacity,
          departsAt: new Date(row.departsAt),
          delegateId,
        },
        create: {
          eventId,
          busId: bus.id,
          pickupPointId: point.id,
          code: tripCode,
          capacity: row.capacity,
          departsAt: new Date(row.departsAt),
          delegateId,
        },
      });
      summary.trips += 1;
    }

    if (summary.pickupPoints === 0 && summary.skipped.length > 0) {
      throw new BadRequestException(`Nothing imported. ${summary.skipped.join('; ')}`);
    }
    return summary;
  }
}
