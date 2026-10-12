/** Mulberry32: a tiny seeded PRNG using only 32-bit integer operations. */
export function nextRandom(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Uniform integer in [0, maxExclusive). */
export function randomInt(state: { rng: number }, maxExclusive: number): number {
  return nextRandom(state) % maxExclusive;
}

/** True with probability pct / 100. */
export function rollPercent(state: { rng: number }, pct: number): boolean {
  return randomInt(state, 100) < pct;
}
