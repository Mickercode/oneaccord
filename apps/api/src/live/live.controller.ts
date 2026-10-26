import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { BreakdownRow, LiveSnapshot } from '@oa/types';
import { PrismaService } from '../common/prisma.service';
import { Roles, TeamGuard } from '../common/team.guard';
import { LiveService } from './live.service';

type GroupBy = 'campus' | 'area' | 'pickup' | 'city';

@ApiTags('live')
@Controller('events/:eventId')
@UseGuards(TeamGuard)
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly prisma: PrismaService,
  ) {}

  /** DB-1 and DB-2. Live updates arrive on the event:<id> socket room. */
  @Get('live')
  @ApiOkResponse({ description: 'Totals, trips and zone fill for the event.' })
  snapshot(@Param('eventId') eventId: string): Promise<LiveSnapshot> {
    return this.live.snapshot(eventId);
  }

  /** DB-3: attendance by campus, area, pickup point or city. */
  @Get('breakdown')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async breakdown(
    @Param('eventId') eventId: string,
    @Query('by') by: GroupBy = 'pickup',
  ): Promise<BreakdownRow[]> {
    if (by === 'city') return this.cityBreakdown();

    const kind = by === 'campus' ? 'CAMPUS' : by === 'area' ? 'AREA' : undefined;
    const points = await this.prisma.pickupPoint.findMany({
      where: { eventId, ...(kind ? { kind } : {}) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, kind: true },
    });

    const [registered, checkIns] = await Promise.all([
      this.prisma.registration.groupBy({
        by: ['pickupPointId'],
        where: { eventId },
        _count: { _all: true },
      }),
      this.prisma.checkIn.findMany({
        where: { registration: { eventId } },
        select: { stage: true, registration: { select: { pickupPointId: true } } },
      }),
    ]);

    const registeredBy = new Map(registered.map((r) => [r.pickupPointId ?? '', r._count._all]));
    const boardedBy = new Map<string, number>();
    const arrivedBy = new Map<string, number>();
    for (const checkIn of checkIns) {
      const key = checkIn.registration.pickupPointId ?? '';
      const target = checkIn.stage === 'BOARDED' ? boardedBy : arrivedBy;
      target.set(key, (target.get(key) ?? 0) + 1);
    }

    const rows: BreakdownRow[] = points.map((point) => ({
      key: point.id,
      label: point.name,
      registered: registeredBy.get(point.id) ?? 0,
      boarded: boardedBy.get(point.id) ?? 0,
      arrived: arrivedBy.get(point.id) ?? 0,
    }));

    if (!kind) {
      rows.push({
        key: 'none',
        label: 'Private and walk-in',
        registered: registeredBy.get('') ?? 0,
        boarded: boardedBy.get('') ?? 0,
        arrived: arrivedBy.get('') ?? 0,
      });
    }
    return rows;
  }

  private async cityBreakdown(): Promise<BreakdownRow[]> {
    const events = await this.prisma.event.findMany({
      orderBy: { startsAt: 'desc' },
      select: { id: true, city: true },
    });
    const rows: BreakdownRow[] = [];
    for (const event of events) {
      const [registered, boarded, arrived] = await Promise.all([
        this.prisma.registration.count({ where: { eventId: event.id } }),
        this.prisma.checkIn.count({
          where: { stage: 'BOARDED', registration: { eventId: event.id } },
        }),
        this.prisma.checkIn.count({
          where: { stage: 'ARRIVED', registration: { eventId: event.id } },
        }),
      ]);
      rows.push({ key: event.id, label: event.city, registered, boarded, arrived });
    }
    return rows;
  }
}
