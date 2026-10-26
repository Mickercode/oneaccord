import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ZoneSummary } from '@oa/types';
import { PrismaService } from '../common/prisma.service';
import { LiveService } from '../live/live.service';

@Injectable()
export class ZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveService,
  ) {}

  /**
   * ZN-2: private and walk-in attendees go to the zone with the most space
   * left. Ties go to the earlier letter, so the hall fills in a readable order.
   */
  async zoneWithMostSpace(eventId: string): Promise<ZoneSummary | null> {
    const [zones, arrived] = await Promise.all([
      this.prisma.zone.findMany({ where: { eventId, closed: false }, orderBy: { letter: 'asc' } }),
      this.prisma.checkIn.groupBy({
        by: ['zoneId'],
        where: { stage: 'ARRIVED', registration: { eventId } },
        _count: { _all: true },
      }),
    ]);
    if (zones.length === 0) return null;

    const inHall = new Map(arrived.map((row) => [row.zoneId ?? '', row._count._all]));
    let best = zones[0];
    let bestSpace = -Infinity;
    for (const zone of zones) {
      const space = zone.capacity - (inHall.get(zone.id) ?? 0);
      if (space > bestSpace) {
        best = zone;
        bestSpace = space;
      }
    }
    return this.toSummary(best);
  }

  async byId(zoneId: string): Promise<ZoneSummary> {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new NotFoundException('We cannot find that zone.');
    return this.toSummary(zone);
  }

  async list(eventId: string): Promise<ZoneSummary[]> {
    const zones = await this.prisma.zone.findMany({
      where: { eventId },
      orderBy: { letter: 'asc' },
    });
    return zones.map((zone) => this.toSummary(zone));
  }

  /** ZN-3: an usher can close a zone that is full. */
  async setClosed(zoneId: string, closed: boolean): Promise<ZoneSummary> {
    const zone = await this.prisma.zone.update({ where: { id: zoneId }, data: { closed } });
    this.live.touch(zone.eventId);
    return this.toSummary(zone);
  }

  /** ZN-3: move a whole trip to another zone, people already seated included. */
  async moveTrip(tripId: string, zoneId: string): Promise<{ moved: number; zone: ZoneSummary }> {
    const [trip, zone] = await Promise.all([
      this.prisma.trip.findUnique({ where: { id: tripId } }),
      this.prisma.zone.findUnique({ where: { id: zoneId } }),
    ]);
    if (!trip) throw new NotFoundException('We cannot find that trip.');
    if (!zone) throw new NotFoundException('We cannot find that zone.');
    if (trip.eventId !== zone.eventId) {
      throw new BadRequestException('That zone belongs to another event.');
    }

    const [registrations] = await this.prisma.$transaction([
      this.prisma.registration.updateMany({ where: { tripId }, data: { zoneId } }),
      this.prisma.checkIn.updateMany({ where: { tripId }, data: { zoneId } }),
    ]);

    this.live.touch(trip.eventId);
    return { moved: registrations.count, zone: this.toSummary(zone) };
  }

  private toSummary(zone: {
    id: string;
    letter: string;
    name: string;
    color: string;
    capacity: number;
    closed: boolean;
  }): ZoneSummary {
    return {
      id: zone.id,
      letter: zone.letter,
      name: zone.name,
      color: zone.color,
      capacity: zone.capacity,
      closed: zone.closed,
    };
  }
}
