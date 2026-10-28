import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

// promisify drops the overload that takes options, so name the shape we use.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Passwords, hashed with scrypt from Node's own crypto.
 *
 * scrypt rather than bcrypt or argon2 because it needs no dependency and no
 * native build: one less thing to go wrong in a container on event day, and
 * it is a memory-hard function designed for exactly this.
 *
 * Stored as `scrypt$N$r$p$salt$hash`, with the parameters written into the
 * string so old hashes keep verifying if we raise the cost later.
 */
const COST = 2 ** 15; // N
const BLOCK = 8; // r
const PARALLEL = 1; // p
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(plain.normalize('NFKC'), salt, KEY_BYTES, {
    N: COST,
    r: BLOCK,
    p: PARALLEL,
    // scrypt needs headroom above the default when N is this high.
    maxmem: 256 * 1024 * 1024,
  });
  return [
    'scrypt',
    COST,
    BLOCK,
    PARALLEL,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

/**
 * Always compares in constant time, and never throws on a malformed stored
 * value: a member with no password simply cannot sign in with one.
 */
export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, cost, block, parallel, salt, expected] = parts;
  const expectedKey = Buffer.from(expected, 'base64url');

  let key: Buffer;
  try {
    key = await scryptAsync(
      plain.normalize('NFKC'),
      Buffer.from(salt, 'base64url'),
      expectedKey.length,
      {
        N: Number(cost),
        r: Number(block),
        p: Number(parallel),
        maxmem: 256 * 1024 * 1024,
      },
    );
  } catch {
    return false;
  }

  if (key.length !== expectedKey.length) return false;
  return timingSafeEqual(key, expectedKey);
}

/**
 * What we refuse outright. Deliberately short: a length floor catches most of
 * what matters, and a long list of rules mostly teaches people to write
 * Passw0rd! — which is in every breach list anyway.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function describePasswordProblem(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (plain.length > 200) return 'That is longer than we can store.';
  return null;
}
