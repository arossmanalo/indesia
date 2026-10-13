import { describe, expect, it } from 'vitest';
import { checkBalance, checkLevel, LEVELS } from '../src/index';

// Every campaign map must be structurally sound and fair: the reference bot earns 3 stars
// and the lazy bot does not. Run `pnpm --filter @indesia/sim balance` for the full report.
describe('campaign', () => {
  it('has 3 maps with 15-20 waves each', () => {
    expect(LEVELS).toHaveLength(3);
    for (const level of LEVELS) {
      expect(level.waves.length).toBeGreaterThanOrEqual(15);
      expect(level.waves.length).toBeLessThanOrEqual(20);
    }
  });

  for (const level of LEVELS) {
    it(`${level.name} is valid and balanced`, () => {
      expect([...checkLevel(level), ...checkBalance(level)]).toEqual([]);
    }, 60_000);
  }
});
