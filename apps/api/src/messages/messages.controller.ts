import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Roles, Team, TeamGuard, type TeamPrincipal } from '../common/team.guard';
import { MessagesService } from './messages.service';

class SendMessageDto {
  @IsIn(['EVENT', 'PICKUP_POINT', 'TRIP'])
  audience: 'EVENT' | 'PICKUP_POINT' | 'TRIP';

  @IsOptional()
  @IsString()
  audienceId?: string;

  @IsString()
  @Length(3, 120)
  subject: string;

  @IsString()
  @Length(3, 4000)
  body: string;

  /** MS-2: essential notes reach everyone; the rest honour the opt-out. */
  @IsBoolean()
  essential: boolean;
}

@ApiTags('messages')
@Controller('events/:eventId/messages')
@UseGuards(TeamGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@Param('eventId') eventId: string) {
    return this.messages.list(eventId);
  }

  @Post()
  send(
    @Param('eventId') eventId: string,
    @Body() dto: SendMessageDto,
    @Team() team: TeamPrincipal,
  ) {
    return this.messages.send(eventId, dto, team.id);
  }
}
