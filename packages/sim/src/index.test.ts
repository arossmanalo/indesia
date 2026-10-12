import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from './index';

describe('SIM_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(SIM_VERSION)).toBe(true);
    expect(SIM_VERSION).toBeGreaterThan(0);
  });
});
