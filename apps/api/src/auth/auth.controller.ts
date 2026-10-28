import {
  BadRequestException,
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
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import type { TeamAuthResult, TeamSession } from '@oa/types';
import { SessionsService } from '../common/sessions.service';
import { Team, TeamGuard, type TeamPrincipal } from '../common/team.guard';
import { AuthService } from './auth.service';

class MagicLinkDto {
  @IsEmail()
  email: string;
}

class SignInDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(200)
  password: string;
}

class SetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('magic-link')
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  async magicLink(@Body() dto: MagicLinkDto) {
    await this.auth.sendMagicLink(dto.email);
    return { sent: true };
  }

  /**
   * The standing accounts sign in here. Throttled hard: this is the one
   * endpoint where guessing gets you somewhere, and the limit is per address
   * as well as per caller so one account cannot be ground down from many IPs.
   */
  @Post('sign-in')
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  async signIn(
    @Body() dto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TeamAuthResult> {
    const signedIn = await this.auth.signInWithPassword(dto.email, dto.password);
    if (!signedIn) {
      throw new UnauthorizedException('That email and password do not match.');
    }

    // Sets the cookie and hands back the same session as a bearer token, so
    // the app works whether or not it shares a site with this API.
    const token = this.sessions.setTeam(res, {
      sub: signedIn.memberId,
      role: signedIn.role,
    });
    const session = await this.auth.session(signedIn.memberId);
    if (!session) throw new UnauthorizedException('Please sign in again.');

    return { token, session };
  }

  /** Set or change your own password. Invited members use this once. */
  @Post('password')
  @UseGuards(TeamGuard)
  async setPassword(@Body() dto: SetPasswordDto, @Team() team: TeamPrincipal) {
    const problem = await this.auth.setPassword(team.id, dto.password);
    if (problem) throw new BadRequestException(problem);
    return { set: true };
  }

  @Get('callback')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async callback(@Query('token') token: string, @Res() res: Response): Promise<void> {
    const redeemed = token ? await this.auth.redeem(token) : null;
    if (!redeemed) {
      res.redirect(`${this.auth.homeFor('DELEGATE')}/sign-in?error=expired`);
      return;
    }
    const session = this.sessions.setTeam(res, { sub: redeemed.memberId, role: redeemed.role });
    // The cookie covers the same-site case. The fragment covers the other one:
    // fragments never reach a server, so the token stays out of access logs
    // and out of the referrer header.
    res.redirect(`${this.auth.homeFor(redeemed.role)}/#t=${encodeURIComponent(session)}`);
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
    this.sessions.clearTeam(res);
    return { signedOut: true };
  }
}
