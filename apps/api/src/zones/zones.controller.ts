import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';
import type { ZoneSummary } from '@oa/types';
import { Roles, TeamGuard } from '../common/team.guard';
import { ZonesService } from './zones.service';

class SetClosedDto {
  @IsBoolean()
  closed: boolean;
}

class MoveTripDto {
  @IsString()
  tripId: string;
}

@ApiTags('zones')
@Controller()
@UseGuards(TeamGuard)
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get('events/:eventId/zones')
  list(@Param('eventId') eventId: string): Promise<ZoneSummary[]> {
    return this.zones.list(eventId);
  }

  @Post('zones/:zoneId/closed')
  @Roles('USHER', 'ADMIN', 'SUPER_ADMIN')
  setClosed(@Param('zoneId') zoneId: string, @Body() body: SetClosedDto): Promise<ZoneSummary> {
    return this.zones.setClosed(zoneId, body.closed);
  }

  @Post('zones/:zoneId/move-trip')
  @Roles('USHER', 'ADMIN', 'SUPER_ADMIN')
  moveTrip(@Param('zoneId') zoneId: string, @Body() body: MoveTripDto) {
    return this.zones.moveTrip(body.tripId, zoneId);
  }
}
