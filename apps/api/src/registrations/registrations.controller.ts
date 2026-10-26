import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import type { RegisterResponse } from '@oa/types';
import { Team, TeamGuard, type TeamPrincipal } from '../common/team.guard';
import { RegistrationsService } from './registrations.service';
import { ForgetMeDto, RegisterDto } from './registrations.dto';
import { normalisePassCode } from '../common/pass-code';

@ApiTags('registrations')
@Controller()
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  /** RG-1. Public, and rate limited because the link goes out on a flyer. */
  @Post('events/:eventId/registrations')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  register(@Param('eventId') eventId: string, @Body() dto: RegisterDto): Promise<RegisterResponse> {
    return this.registrations.register(eventId, dto);
  }

  /** RG-5: what to offer when every trip from a pickup point is full. */
  @Get('events/:eventId/pickup-points/:pickupPointId/alternatives')
  alternatives(@Param('eventId') eventId: string, @Param('pickupPointId') pickupPointId: string) {
    return this.registrations.alternatives(eventId, pickupPointId);
  }

  /** BD-5: the delegate looks someone up by name. */
  @Get('events/:eventId/registrations/search')
  @UseGuards(TeamGuard)
  search(
    @Param('eventId') eventId: string,
    @Query('q') query: string,
    @Query('tripId') tripId?: string,
  ) {
    if (!query) throw new BadRequestException('Type at least two letters.');
    return this.registrations.searchByName(eventId, query, tripId);
  }

  @Post('registrations/:id/resend')
  @UseGuards(TeamGuard)
  async resend(@Param('id') id: string, @Team() _team: TeamPrincipal) {
    await this.registrations.sendPass(id);
    return { sent: true };
  }

  /**
   * The attendee's right to be forgotten, proved by the pass code and the
   * address it was sent to. Rate limited hard: the pass code is only four
   * characters, so this must not be a door to try codes behind.
   */
  @Post('passes/:code/forget')
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  async forget(@Param('code') code: string, @Body() body: ForgetMeDto) {
    const passCode = normalisePassCode(code);
    const done = passCode ? await this.registrations.forget(passCode, body.email) : false;
    if (!done) {
      throw new NotFoundException('We cannot find a pass with that code and email address.');
    }
    return { removed: true };
  }

  /** MS-2 */
  @Post('registrations/:id/unsubscribe/:token')
  async unsubscribe(@Param('id') id: string, @Param('token') token: string) {
    const done = await this.registrations.unsubscribe(id, token);
    if (!done) throw new BadRequestException('That unsubscribe link is not valid.');
    return { unsubscribed: true };
  }
}
