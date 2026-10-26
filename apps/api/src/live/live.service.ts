import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { LiveSnapshot, LiveTotals, TripSummary, ZoneFill } from '@oa/types';
import { PrismaService } from '../common/prisma.service';

/** No more than this often per event, so a boarding rush cannot melt the dashboard. */
const THROTTLE_MS = 1_000;

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);
  /** The gateway subscribes; the service stays free of socket.io. */
  readonly changes = new EventEmitter();

  private pending = new Map<string, NodeJS.Timeout>();

  constructor(private readonly prisma: PrismaService) {}

  /** Something changed for this event: recompute soon and tell the room. */
  touch(eventId: string): void {
    if (this.pending.has(eventId)) return;
    const timer = setTimeout(() => {
      this.pending.delete(eventId);
      this.snapshot(eventId)
        .then((snapshot) => this.changes.emit('snapshot', snapshot))
        .catch((error) => this.logger.warn(`Live snapshot for ${eventId} failed: ${error}`));
    }, THROTTLE_MS);
    timer.unref?.();
    this.pending.set(eventId, timer);
  }

  /** The count on the delegate's own screen, which must move at once. BD-1. */
  async tripBoarded(tripId: string): Promise<number> {
    return this.prisma.checkIn.count({ where: { tripId, stage: 'BOARDED' } });
  }

  async snapshot(eventId: string): Promise<LiveSnapshot> {
    const [registered, trips, zones, boardedRows, arrivedRows] = await Promise.all([
      this.prisma.registration.count({ where: { eventId } }),
      this.prisma.trip.findMany({
        where: { eventId },
        orderBy: [{ departsAt: 'asc' }, { code: 'asc' }],
        include: {
          pickupPoint: { select: { name: true } },
          delegate: { select: { fullName: true } },
        },
      }),
      this.prisma.zone.findMany({ where: { eventId }, orderBy: { letter: 'asc' } }),
      this.prisma.checkIn.groupBy({
        by: ['tripId'],
        where: { stage: 'BOARDED', registration: { eventId } },
        _count: { _all: true },
      }),
      this.prisma.checkIn.groupBy({
        by: ['zoneId'],
        where: { stage: 'ARRIVED', registration: { eventId } },
        _count: { _all: true },
      }),
    ]);

    const boarded = boardedRows.reduce((sum, row) => sum + row._count._all, 0);
    const arrived = arrivedRows.reduce((sum, row) => sum + row._count._all, 0);

    const departedTripIds = new Set(
      trips.filter((trip) => trip.status === 'DEPARTED').map((trip) => trip.id),
    );
    const onTheWay = boardedRows
      .filter((row) => row.tripId && departedTripIds.has(row.tripId))
      .reduce((sum, row) => sum + row._count._all, 0);

    const boardedByTrip = new Map(
      boardedRows.map((row) => [row.tripId ?? '', row._count._all] as const),
    );
    const arrivedByZone = new Map(
      arrivedRows.map((row) => [row.zoneId ?? '', row._count._all] as const),
    );

    const zoneFills: ZoneFill[] = zones.map((zone) => {
      const inHall = arrivedByZone.get(zone.id) ?? 0;
      return {
        id: zone.id,
        letter: zone.letter,
        name: zone.name,
        color: zone.color,
        capacity: zone.capacity,
        closed: zone.closed,
        inHall,
        fill: zone.capacity > 0 ? Math.min(1, inHall / zone.capacity) : 0,
      };
    });

    const tripSummaries: TripSummary[] = trips.map((trip) => ({
      id: trip.id,
      code: trip.code,
      status: trip.status,
      capacity: trip.capacity,
      departsAt: trip.departsAt.toISOString(),
      pickupPointName: trip.pickupPoint.name,
      delegateFirstName: trip.delegate?.fullName.split(' ')[0] ?? null,
      whatsappUrl: trip.whatsappUrl,
      boardedCount: boardedByTrip.get(trip.id) ?? 0,
    }));

    const totals: LiveTotals = {
      registered,
      boarded,
      onTheWay,
      arrived,
      inHall: arrived,
    };

    return {
      eventId,
      at: new Date().toISOString(),
      totals,
      trips: tripSummaries,
      zones: zoneFills,
    };
  }
}
