import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { AppConfig, CONFIG } from './config';

export const PASS_COOKIE = 'oa_pass';
export const TEAM_COOKIE = 'oa_team';

/** What a phone carries to say which attendee it belongs to. */
export interface PassSession {
  rid: string;
  eid: string;
  code: string;
  v: number;
}

export interface TeamSessionClaims {
  sub: string;
  role: string;
}

const PASS_DAYS = 120;
/** Short sessions for the team, as the security section asks. */
const TEAM_HOURS = 12;

/**
 * Sessions for attendees and for the team, carried two ways.
 *
 * A cookie is the better carrier: `httpOnly` keeps it away from JavaScript, so
 * a cross-site scripting hole cannot read it. But a cookie only reaches the API
 * when the apps and the API are on one registrable domain. When they are not —
 * apps on Vercel, API on Railway — the browser treats the call as cross-site
 * and withholds it, and Safari blocks it outright.
 *
 * So every session is also issued as a bearer token the app holds and sends in
 * an Authorization header, which works wherever the apps are served from. The
 * cookie is still set and still read first where it works. Put the apps and the
 * API on one domain later and the cookie quietly takes over again.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  private cookieOptions() {
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

  private bearer(req: Request): string | null {
    const header = req.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  }

  private verify<T extends object>(token: string | null | undefined): T | null {
    if (!token) return null;
    try {
      return this.jwt.verify<T>(token);
    } catch {
      return null;
    }
  }

  /** PS-2: what makes a phone remember the attendee who opened the pass. */
  issuePass(payload: PassSession): string {
    return this.jwt.sign(payload, { expiresIn: `${PASS_DAYS}d` });
  }

  setPass(res: Response, payload: PassSession): string {
    const token = this.issuePass(payload);
    res.cookie(PASS_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: PASS_DAYS * 86_400_000,
    });
    return token;
  }

  readPass(req: Request): PassSession | null {
    return (
      this.verify<PassSession>(req.cookies?.[PASS_COOKIE]) ??
      this.verify<PassSession>(this.bearer(req))
    );
  }

  clearPass(res: Response): void {
    res.clearCookie(PASS_COOKIE, this.cookieOptions());
  }

  issueTeam(payload: TeamSessionClaims): string {
    return this.jwt.sign(payload, { expiresIn: `${TEAM_HOURS}h` });
  }

  setTeam(res: Response, payload: TeamSessionClaims): string {
    const token = this.issueTeam(payload);
    res.cookie(TEAM_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: TEAM_HOURS * 3_600_000,
    });
    return token;
  }

  readTeam(req: Request): TeamSessionClaims | null {
    return (
      this.verify<TeamSessionClaims>(this.bearer(req)) ??
      this.verify<TeamSessionClaims>(req.cookies?.[TEAM_COOKIE])
    );
  }

  clearTeam(res: Response): void {
    res.clearCookie(TEAM_COOKIE, this.cookieOptions());
  }
}
