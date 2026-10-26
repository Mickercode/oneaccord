import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DateTime } from 'luxon';
import { PrismaService } from '../common/prisma.service';
import { Roles, TeamGuard } from '../common/team.guard';

const PAGE = 1_000;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Stop a spreadsheet treating a leading =, + or @ as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function line(values: unknown[]): string {
  return `${values.map(cell).join(',')}\n`;
}

@ApiTags('export')
@Controller('events/:eventId/export')
@UseGuards(TeamGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class ExportController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * DB-4: attendees and their check-ins, one row per attendee, streamed so a
   * city's worth of rows never sits in memory.
   */
  @Get()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async csv(
    @Param('eventId') eventId: string,
    @Res() res: Response,
    @Query('tz') tz?: string,
  ): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    const timezone = tz ?? event?.timezone ?? 'Africa/Lagos';
    const stamp = DateTime.now().setZone(timezone).toFormat('yyyy-LL-dd');
    const name = `one-accord-${event?.slug ?? eventId}-${stamp}.csv`;

    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.write('﻿'); // So Excel opens the Nigerian names correctly.
    res.write(
      line([
        'Pass code',
        'Full name',
        'Email',
        'Phone',
        'Type',
        'Pickup point',
        'Registered trip',
        'Zone',
        'Registered at',
        'Boarded at',
        'Boarded trip',
        'Boarded method',
        'Arrived at',
        'Arrived method',
      ]),
    );

    const when = (date: Date | null | undefined) =>
      date ? DateTime.fromJSDate(date).setZone(timezone).toFormat('yyyy-LL-dd HH:mm:ss') : '';

    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.registration.findMany({
        where: { eventId },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          pickupPoint: { select: { name: true } },
          trip: { select: { code: true } },
          zone: { select: { letter: true } },
          checkIns: { include: { trip: { select: { code: true } } } },
        },
      });
      if (batch.length === 0) break;

      for (const registration of batch) {
        const boarded = registration.checkIns.find((checkIn) => checkIn.stage === 'BOARDED');
        const arrived = registration.checkIns.find((checkIn) => checkIn.stage === 'ARRIVED');
        res.write(
          line([
            registration.passCode,
            registration.fullName,
            registration.email,
            registration.phone,
            registration.type,
            registration.pickupPoint?.name,
            registration.trip?.code,
            registration.zone?.letter,
            when(registration.createdAt),
            when(boarded?.createdAt),
            boarded?.trip?.code,
            boarded?.method,
            when(arrived?.createdAt),
            arrived?.method,
          ]),
        );
      }

      cursor = batch[batch.length - 1]?.id;
      if (batch.length < PAGE) break;
    }

    res.end();
  }
}
