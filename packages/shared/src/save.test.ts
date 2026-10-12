import { describe, expect, it } from 'vitest';
import { emptySave, mergeSaves, Save } from './save';

describe('mergeSaves', () => {
  it('keeps the best result per level from both sides', () => {
    const a: Save = {
      ...emptySave(),
      levels: { meadow: { stars: 3, bestScore: 100 }, fen: { stars: 1, bestScore: 50 } },
    };
    const b: Save = {
      ...emptySave(),
      levels: { meadow: { stars: 2, bestScore: 900 }, pass: { stars: 1, bestScore: 10 } },
    };
    expect(mergeSaves(a, b).levels).toEqual({
      meadow: { stars: 3, bestScore: 900 },
      fen: { stars: 1, bestScore: 50 },
      pass: { stars: 1, bestScore: 10 },
    });
  });

  it('takes the most recently changed settings', () => {
    const older = { ...emptySave('2026-01-01T00:00:00.000Z') };
    const newer = {
      ...emptySave('2026-02-01T00:00:00.000Z'),
      settings: { music: 0, sfx: 10, speed: 2 as const, reducedShake: true },
    };
    expect(mergeSaves(older, newer).settings).toEqual(newer.settings);
    expect(mergeSaves(newer, older).settings).toEqual(newer.settings);
  });

  it('round-trips through the schema', () => {
    expect(Save.parse(emptySave())).toEqual(emptySave());
  });
});
