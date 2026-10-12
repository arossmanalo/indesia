import { describe, expect, it } from 'vitest';
import { Hasher, hashString } from './hash';
import { isqrt, tilesPerSecondToUnitsPerTick } from './math';
import { nextRandom, randomInt } from './rng';

describe('isqrt', () => {
  it('floors square roots of integers', () => {
    expect(isqrt(0)).toBe(0);
    expect(isqrt(15)).toBe(3);
    expect(isqrt(16)).toBe(4);
    expect(isqrt(1024 * 1024 * 2)).toBe(1448);
  });
});

describe('conversions', () => {
  it('never produces a zero speed', () => {
    expect(tilesPerSecondToUnitsPerTick(0.01)).toBe(1);
  });
});

describe('rng', () => {
  it('is reproducible from a seed', () => {
    const a = { rng: 42 };
    const b = { rng: 42 };
    const seqA = Array.from({ length: 5 }, () => nextRandom(a));
    const seqB = Array.from({ length: 5 }, () => nextRandom(b));
    expect(seqA).toEqual(seqB);
    expect(seqA).toMatchInlineSnapshot(`
      [
        2581720956,
        1925393290,
        3661312704,
        2876485805,
        750819978,
      ]
    `);
  });

  it('stays in range', () => {
    const s = { rng: 7 };
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(s, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});

describe('hash', () => {
  it('is stable and order-sensitive', () => {
    expect(hashString('indesia')).toBe(hashString('indesia'));
    expect(new Hasher().int(1).int(2).hex()).not.toBe(new Hasher().int(2).int(1).hex());
    expect(new Hasher().int(-1).hex()).not.toBe(new Hasher().int(0xffffffff).hex());
  });
});
