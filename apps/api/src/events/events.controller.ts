import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { EventSummary, PickupPointSummary } from '@oa/types';
import { Roles, TeamGuard } from '../common/team.guard';
import { EventsService } from './events.service';
import {
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

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /** Public: the registration page. */
  @Get(':idOrSlug/public')
  publicView(@Param('idOrSlug') idOrSlug: string) {
    return this.events.publicView(idOrSlug);
  }

  /** Public: RG-2 and RG-5. */
  @Get(':eventId/pickup-points')
  pickupPoints(@Param('eventId') eventId: string): Promise<PickupPointSummary[]> {
    return this.events.pickupPoints(eventId);
  }

  @Get()
  @UseGuards(TeamGuard)
  list(): Promise<EventSummary[]> {
    return this.events.list();
  }

  @Post()
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() dto: CreateEventDto): Promise<EventSummary> {
    return this.events.create(dto);
  }

  @Patch(':eventId')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('eventId') eventId: string, @Body() dto: UpdateEventDto): Promise<EventSummary> {
    return this.events.update(eventId, dto);
  }

  @Post(':eventId/zones')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  addZone(@Param('eventId') eventId: string, @Body() dto: ZoneDto) {
    return this.events.addZone(eventId, dto);
  }

  @Post(':eventId/pickup-points')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  addPickupPoint(@Param('eventId') eventId: string, @Body() dto: PickupPointDto) {
    return this.events.addPickupPoint(eventId, dto);
  }

  @Get(':eventId/buses')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  buses(@Param('eventId') eventId: string) {
    return this.events.buses(eventId);
  }

  @Post(':eventId/buses')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  addBus(@Param('eventId') eventId: string, @Body() dto: BusDto) {
    return this.events.addBus(eventId, dto);
  }

  @Post(':eventId/trips')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  addTrip(@Param('eventId') eventId: string, @Body() dto: TripDto) {
    return this.events.addTrip(eventId, dto);
  }

  @Get(':eventId/gates')
  @UseGuards(TeamGuard)
  gates(@Param('eventId') eventId: string) {
    return this.events.gates(eventId);
  }

  @Post(':eventId/gates')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  addGate(@Param('eventId') eventId: string, @Body() dto: GateDto) {
    return this.events.addGate(eventId, dto);
  }

  @Get(':eventId/team')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  team(@Param('eventId') eventId: string) {
    return this.events.team(eventId);
  }

  /** EV-5 */
  @Post(':eventId/team')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  invite(@Param('eventId') eventId: string, @Body() dto: InviteDto) {
    return this.events.invite(eventId, dto);
  }

  /** EV-6 */
  @Post(':eventId/duplicate')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  duplicate(@Param('eventId') eventId: string, @Body() dto: DuplicateEventDto) {
    return this.events.duplicate(eventId, dto);
  }

  /** EV-7 */
  @Post(':eventId/import')
  @UseGuards(TeamGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  import(@Param('eventId') eventId: string, @Body() dto: ImportDto) {
    return this.events.importSetup(eventId, dto);
  }
}
