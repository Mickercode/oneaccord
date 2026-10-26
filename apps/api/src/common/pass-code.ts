import { randomInt } from 'node:crypto';
import { PASS_CODE_ALPHABET, PASS_CODE_LENGTH, PASS_CODE_PREFIX } from '@oa/types';

/**
 * PS-3: four characters after "UR-", from an alphabet with no look-alikes,
 * unique within the event. Four characters of this alphabet give about
 * 924,000 codes, and the caller retries on the rare collision.
 */
export function newPassCode(): string {
  let code = '';
  for (let i = 0; i < PASS_CODE_LENGTH; i += 1) {
    code += PASS_CODE_ALPHABET[randomInt(PASS_CODE_ALPHABET.length)];
  }
  return `${PASS_CODE_PREFIX}${code}`;
}

/**
 * Accepts "ur4k7q", "UR-4K7Q" or " ur 4k7q " and returns "UR-4K7Q".
 * The alphabet has no 0, O, 1, I or L, so a code containing one was misread
 * rather than mistyped: better to say we cannot find it than to guess wrong.
 */
export function normalisePassCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = cleaned.startsWith('UR') ? cleaned.slice(2) : cleaned;
  if (body.length !== PASS_CODE_LENGTH) return null;
  if (![...body].every((character) => PASS_CODE_ALPHABET.includes(character))) return null;
  return `${PASS_CODE_PREFIX}${body}`;
}

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}
