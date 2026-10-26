import { newPassCode, normalisePassCode, normaliseEmail } from '../src/common/pass-code';
import { PASS_CODE_ALPHABET } from '@oa/types';

describe('pass codes', () => {
  it('reads as UR- and four characters', () => {
    expect(newPassCode()).toMatch(/^UR-[0-9A-Z]{4}$/);
  });

  // PS-3: a delegate reads these aloud in a noisy car park.
  it('never contains a look-alike character', () => {
    const codes = Array.from({ length: 2_000 }, newPassCode).join('');
    expect(codes).not.toMatch(/[01OIL]/);
    for (const character of codes.replace(/UR-/g, '')) {
      expect(PASS_CODE_ALPHABET).toContain(character);
    }
  });

  it('spreads across the alphabet rather than favouring a few letters', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 5_000; i += 1) {
      for (const character of newPassCode().slice(3)) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(PASS_CODE_ALPHABET.length);
  });

  describe('what people actually type', () => {
    it.each([
      ['UR-4K7Q', 'UR-4K7Q'],
      ['ur-4k7q', 'UR-4K7Q'],
      ['ur4k7q', 'UR-4K7Q'],
      ['4K7Q', 'UR-4K7Q'],
      ['  ur 4k7q  ', 'UR-4K7Q'],
      ['UR–4K7Q', 'UR-4K7Q'],
    ])('reads %p as %p', (typed, expected) => {
      expect(normalisePassCode(typed)).toBe(expected);
    });

    it.each([
      ['UR-4K7', 'too short'],
      ['UR-4K7QQ', 'too long'],
      ['', 'empty'],
      ['UR-4K7O', 'contains a letter the alphabet never uses'],
      ['UR-4K7!', 'punctuation'],
    ])('refuses %p (%s)', (typed) => {
      expect(normalisePassCode(typed)).toBeNull();
    });
  });
});

describe('emails', () => {
  it.each([
    ['Ada@Example.COM', 'ada@example.com'],
    ['  ada@example.com ', 'ada@example.com'],
  ])('reads %p as %p', (typed, expected) => {
    expect(normaliseEmail(typed)).toBe(expected);
  });
});
