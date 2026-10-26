import { TokensService } from '../src/common/tokens.service';
import type { AppConfig } from '../src/common/config';

const config = {
  secret: 'a-test-secret',
  webUrl: 'https://oneaccord.test',
} as AppConfig;

const WINDOW_MS = 30_000;

describe('TokensService', () => {
  const tokens = new TokensService(config);

  describe('boarding codes', () => {
    it('accepts the code it has just issued', () => {
      const token = tokens.boardingToken('trip-12a');
      expect(tokens.verify(token)).toEqual({
        kind: 'b',
        tripId: 'trip-12a',
        window: expect.any(Number),
      });
    });

    it('still accepts the previous window, so a scan mid-rotation works', () => {
      const now = new Date();
      const token = tokens.boardingToken('trip-12a', now);
      const oneWindowLater = new Date(now.getTime() + WINDOW_MS);
      expect(tokens.verify(token, oneWindowLater)).toMatchObject({ kind: 'b', tripId: 'trip-12a' });
    });

    // BD-4: a screenshot shared in a group chat must not check anyone in.
    it('refuses a code older than 60 seconds', () => {
      const now = new Date();
      const token = tokens.boardingToken('trip-12a', now);
      const twoWindowsLater = new Date(now.getTime() + 2 * WINDOW_MS);
      expect(tokens.verify(token, twoWindowsLater)).toBe('EXPIRED');
    });

    it('refuses a code from the future', () => {
      const now = new Date();
      const token = tokens.boardingToken('trip-12a', new Date(now.getTime() + 5 * WINDOW_MS));
      expect(tokens.verify(token, now)).toBe('EXPIRED');
    });

    it('refuses a code signed with another secret', () => {
      const other = new TokensService({ ...config, secret: 'a-different-secret' } as AppConfig);
      expect(tokens.verify(other.boardingToken('trip-12a'))).toBe('BAD_TOKEN');
    });

    it('refuses a token whose payload has been edited', () => {
      const token = tokens.boardingToken('trip-12a');
      const [payload, signature] = token.split('.');
      const edited = Buffer.from(
        Buffer.from(payload, 'base64url').toString('utf8').replace('trip-12a', 'trip-99z'),
        'utf8',
      ).toString('base64url');
      expect(tokens.verify(`${edited}.${signature}`)).toBe('BAD_TOKEN');
    });

    it.each(['', 'nonsense', 'a.b', '....', 'YjoxOjI='])('refuses the junk %p', (junk) => {
      expect(typeof tokens.verify(junk)).toBe('string');
    });

    it('issues a different code in each window', () => {
      const now = new Date();
      const first = tokens.boardingToken('trip-12a', now);
      const second = tokens.boardingToken('trip-12a', new Date(now.getTime() + WINDOW_MS));
      expect(first).not.toEqual(second);
    });

    it('points the QR at the attendee app', () => {
      expect(tokens.boardingUrl('trip-12a')).toMatch(/^https:\/\/oneaccord\.test\/b\/.+/);
    });
  });

  describe('gate codes', () => {
    // GT-3: fixed per gate, so the poster can be printed days ahead.
    it('stays valid however much time passes', () => {
      const token = tokens.gateToken('gate-main');
      const nextYear = new Date(Date.now() + 365 * 24 * 3_600_000);
      expect(tokens.verify(token, nextYear)).toEqual({ kind: 'g', gateId: 'gate-main' });
    });

    it('cannot be passed off as a boarding code', () => {
      const result = tokens.verify(tokens.gateToken('gate-main'));
      expect(result).not.toBe('BAD_TOKEN');
      expect((result as { kind: string }).kind).toBe('g');
    });
  });

  describe('magic links', () => {
    it('stores only a hash of the token', () => {
      const { token, hash } = tokens.magicLinkToken();
      expect(hash).toHaveLength(64);
      expect(hash).not.toContain(token);
      expect(tokens.hash(token)).toBe(hash);
    });

    it('never issues the same token twice', () => {
      const seen = new Set(Array.from({ length: 200 }, () => tokens.magicLinkToken().token));
      expect(seen.size).toBe(200);
    });
  });
});
