import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { CheckInResult, ScanContext } from '@oa/types';
import { CookiesService } from '../common/cookies.service';
import { Roles, Team, TeamGuard, type TeamPrincipal } from '../common/team.guard';
import { CheckInsService } from './checkins.service';
import { ByNameDto, ScanDto, WalkInDto } from './checkins.dto';

@ApiTags('check-in')
@Controller('checkins')
export class CheckInsController {
  constructor(
    private readonly checkIns: CheckInsService,
    private readonly cookies: CookiesService,
  ) {}

  /** What the scanned page shows before the attendee taps. */
  @Get('context')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  context(@Query('token') token: string, @Req() req: Request): Promise<ScanContext> {
    return this.checkIns.context(token, this.cookies.readPass(req));
  }

  /** BD-2: the one tap on the bus. */
  @Post('boarding')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  boarding(@Body() dto: ScanDto, @Req() req: Request): Promise<CheckInResult> {
    return this.checkIns.boarding(dto, this.cookies.readPass(req));
  }

  /** GT-2: the poster in the security queue. */
  @Post('gate')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  gate(@Body() dto: ScanDto, @Req() req: Request): Promise<CheckInResult> {
    return this.checkIns.gate(dto, this.cookies.readPass(req));
  }

  /** GT-4: register and check in at once. */
  @Post('walk-in')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  walkIn(@Body() dto: WalkInDto): Promise<CheckInResult> {
    return this.checkIns.walkIn(dto);
  }

  /** BD-5: the delegate checks in someone without a phone. */
  @Post('by-name')
  @UseGuards(TeamGuard)
  @Roles('DELEGATE', 'USHER', 'ADMIN', 'SUPER_ADMIN')
  byName(@Body() dto: ByNameDto, @Team() team: TeamPrincipal): Promise<CheckInResult> {
    return this.checkIns.byName(dto.tripId, dto.registrationId, team.id);
  }

  /** GT-5: an usher looks someone up. */
  @Get('look-up/:eventId')
  @UseGuards(TeamGuard)
  lookUp(@Param('eventId') eventId: string, @Query('q') query: string) {
    return this.checkIns.lookUp(eventId, query ?? '');
  }
}
