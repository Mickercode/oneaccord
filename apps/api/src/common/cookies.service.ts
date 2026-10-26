import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AppConfig, CONFIG } from './config';

export const PASS_COOKIE = 'oa_pass';
export const TEAM_COOKIE = 'oa_team';

export interface PassCookie {
  rid: string;
  eid: string;
  code: string;
  v: number;
}

export interface TeamCookie {
  sub: string;
  role: string;
}

const PASS_COOKIE_DAYS = 120;
/** Short sessions for the team, as the security section asks. */
const TEAM_COOKIE_HOURS = 12;

@Injectable()
export class CookiesService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private base() {
    const production = this.config.nodeEnv === 'production';
    return {
      httpOnly: true,
      secure: production,
      // The QR code opens our own page, so lax is enough and survives the scan.
      sameSite: 'lax' as const,
      path: '/',
      domain: this.config.cookieDomain,
    };
  }

  /** PS-2: opening the UR Pass on a phone remembers the attendee on that phone. */
  setPass(res: Response, payload: PassCookie): void {
    const token = this.jwt.sign(payload, { expiresIn: `${PASS_COOKIE_DAYS}d` });
    res.cookie(PASS_COOKIE, token, { ...this.base(), maxAge: PASS_COOKIE_DAYS * 86_400_000 });
  }

  readPass(req: Request): PassCookie | null {
    const raw = req.cookies?.[PASS_COOKIE];
    if (!raw) return null;
    try {
      return this.jwt.verify<PassCookie>(raw);
    } catch {
      return null;
    }
  }

  clearPass(res: Response): void {
    res.clearCookie(PASS_COOKIE, this.base());
  }

  setTeam(res: Response, payload: TeamCookie): void {
    const token = this.jwt.sign(payload, { expiresIn: `${TEAM_COOKIE_HOURS}h` });
    res.cookie(TEAM_COOKIE, token, { ...this.base(), maxAge: TEAM_COOKIE_HOURS * 3_600_000 });
  }

  readTeam(req: Request): TeamCookie | null {
    const header = req.headers.authorization;
    const raw = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.[TEAM_COOKIE];
    if (!raw) return null;
    try {
      return this.jwt.verify<TeamCookie>(raw);
    } catch {
      return null;
    }
  }

  clearTeam(res: Response): void {
    res.clearCookie(TEAM_COOKIE, this.base());
  }
}
