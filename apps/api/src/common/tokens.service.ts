import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { BOARDING_WINDOW_SECONDS, BOARDING_WINDOW_GRACE } from '@oa/types';
import { AppConfig, CONFIG } from './config';

export interface BoardingTokenPayload {
  kind: 'b';
  tripId: string;
  window: number;
}

export interface GateTokenPayload {
  kind: 'g';
  gateId: string;
}

export type ScanTokenPayload = BoardingTokenPayload | GateTokenPayload;

export type TokenFailure = 'BAD_TOKEN' | 'EXPIRED';

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function unb64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/**
 * Boarding and gate codes. The token carries the trip (or gate) and, for
 * boarding, the 30-second window it belongs to, signed with the server secret
 * so it cannot be guessed or forged. See "How the rotating boarding code works".
 */
@Injectable()
export class TokensService {
  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  private sign(body: string): string {
    return createHmac('sha256', this.config.secret).update(body).digest('base64url').slice(0, 22);
  }

  private pack(body: string): string {
    return `${b64url(body)}.${this.sign(body)}`;
  }

  private unpack(token: string): string | null {
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    const encoded = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    let body: string;
    try {
      body = unb64url(encoded);
    } catch {
      return null;
    }
    const expected = this.sign(body);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return body;
  }

  /** The window number a moment belongs to. */
  windowFor(at: Date = new Date()): number {
    return Math.floor(at.getTime() / 1000 / BOARDING_WINDOW_SECONDS);
  }

  /** Unix seconds when the current window gives way to the next one. */
  windowEndsAt(at: Date = new Date()): number {
    return (this.windowFor(at) + 1) * BOARDING_WINDOW_SECONDS;
  }

  boardingToken(tripId: string, at: Date = new Date()): string {
    return this.pack(`b:${tripId}:${this.windowFor(at)}`);
  }

  gateToken(gateId: string): string {
    return this.pack(`g:${gateId}`);
  }

  boardingUrl(tripId: string, at: Date = new Date()): string {
    return `${this.config.webUrl}/b/${this.boardingToken(tripId, at)}`;
  }

  gateUrl(gateId: string): string {
    return `${this.config.webUrl}/g/${this.gateToken(gateId)}`;
  }

  /**
   * BD-4: the current window and the one before it are accepted, so a code is
   * good for at most 60 seconds and a screenshot shared in a group chat is not.
   */
  verify(token: string, at: Date = new Date()): ScanTokenPayload | TokenFailure {
    const body = this.unpack(token);
    if (!body) return 'BAD_TOKEN';
    const parts = body.split(':');
    if (parts[0] === 'g' && parts.length === 2) {
      return { kind: 'g', gateId: parts[1] };
    }
    if (parts[0] === 'b' && parts.length === 3) {
      const tripId = parts[1];
      const window = Number(parts[2]);
      if (!Number.isFinite(window)) return 'BAD_TOKEN';
      const current = this.windowFor(at);
      const age = current - window;
      if (age < 0 || age > BOARDING_WINDOW_GRACE) return 'EXPIRED';
      return { kind: 'b', tripId, window };
    }
    return 'BAD_TOKEN';
  }

  /** A one-time magic-link token for the team. Only its hash is stored. */
  magicLinkToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
