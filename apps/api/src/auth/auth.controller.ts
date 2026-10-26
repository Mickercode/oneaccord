import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import type { Request, Response } from 'express';
import type { TeamSession } from '@oa/types';
import { CookiesService } from '../common/cookies.service';
import { Team, TeamGuard, type TeamPrincipal } from '../common/team.guard';
import { AuthService } from './auth.service';

class MagicLinkDto {
  @IsEmail()
  email: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: CookiesService,
  ) {}

  @Post('magic-link')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  async magicLink(@Body() dto: MagicLinkDto) {
    await this.auth.sendMagicLink(dto.email);
    return { sent: true };
  }

  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async callback(@Query('token') token: string, @Res() res: Response): Promise<void> {
    const redeemed = token ? await this.auth.redeem(token) : null;
    if (!redeemed) {
      res.redirect(`${this.auth.homeFor('DELEGATE')}/sign-in?error=expired`);
      return;
    }
    this.cookies.setTeam(res, { sub: redeemed.memberId, role: redeemed.role });
    res.redirect(this.auth.homeFor(redeemed.role));
  }

  @Get('me')
  @UseGuards(TeamGuard)
  async me(@Team() team: TeamPrincipal): Promise<TeamSession> {
    const session = await this.auth.session(team.id);
    if (!session) throw new UnauthorizedException('Please sign in again.');
    return session;
  }

  @Post('sign-out')
  signOut(@Req() _req: Request, @Res({ passthrough: true }) res: Response) {
    this.cookies.clearTeam(res);
    return { signedOut: true };
  }
}
