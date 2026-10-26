import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { BoardedAttendee, BoardingCodeResponse, TripSummary } from '@oa/types';
import { Roles, Team, TeamGuard, type TeamPrincipal } from '../common/team.guard';
import { TripsService } from './trips.service';

class AddWalkInDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  fullName: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(160)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

@ApiTags('trips')
@Controller()
@UseGuards(TeamGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get('events/:eventId/trips')
  list(
    @Param('eventId') eventId: string,
    @Query('status') status?: string,
  ): Promise<TripSummary[]> {
    return this.trips.list(eventId, status);
  }

  /** The delegate's own trips, so their screen opens on the right one. */
  @Get('trips/mine')
  mine(@Team() team: TeamPrincipal): Promise<TripSummary[]> {
    return this.trips.forDelegate(team);
  }

  /** BD-1 */
  @Get('trips/:tripId/boarding-code')
  @Roles('DELEGATE', 'ADMIN', 'SUPER_ADMIN')
  boardingCode(
    @Param('tripId') tripId: string,
    @Team() team: TeamPrincipal,
  ): Promise<BoardingCodeResponse> {
    return this.trips.boardingCode(tripId, team);
  }

  @Get('trips/:tripId/boarded')
  boarded(
    @Param('tripId') tripId: string,
    @Team() team: TeamPrincipal,
  ): Promise<BoardedAttendee[]> {
    return this.trips.boarded(tripId, team);
  }

  @Get('trips/:tripId/manifest')
  manifest(@Param('tripId') tripId: string, @Team() team: TeamPrincipal) {
    return this.trips.manifest(tripId, team);
  }

  /** BD-5 */
  @Post('trips/:tripId/attendees')
  @Roles('DELEGATE', 'ADMIN', 'SUPER_ADMIN')
  addWalkIn(
    @Param('tripId') tripId: string,
    @Body() dto: AddWalkInDto,
    @Team() team: TeamPrincipal,
  ) {
    return this.trips.addWalkIn(tripId, team, dto);
  }

  /** BD-8 */
  @Post('trips/:tripId/depart')
  @Roles('DELEGATE', 'ADMIN', 'SUPER_ADMIN')
  depart(@Param('tripId') tripId: string, @Team() team: TeamPrincipal): Promise<TripSummary> {
    return this.trips.depart(tripId, team);
  }

  @Post('trips/:tripId/reopen')
  @Roles('ADMIN', 'SUPER_ADMIN')
  reopen(@Param('tripId') tripId: string): Promise<TripSummary> {
    return this.trips.reopen(tripId);
  }

  /** GT-1 */
  @Post('trips/:tripId/arrive')
  @Roles('USHER', 'ADMIN', 'SUPER_ADMIN')
  arrive(@Param('tripId') tripId: string, @Team() team: TeamPrincipal) {
    return this.trips.confirmArrival(tripId, team);
  }
}
