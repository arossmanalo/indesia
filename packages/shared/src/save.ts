import { z } from 'zod';

export const LevelProgress = z.object({
  stars: z.number().int().min(0).max(3),
  bestScore: z.number().int().nonnegative(),
});
export type LevelProgress = z.infer<typeof LevelProgress>;

export const Settings = z.object({
  music: z.number().int().min(0).max(100),
  sfx: z.number().int().min(0).max(100),
  speed: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  reducedShake: z.boolean(),
});
export type Settings = z.infer<typeof Settings>;

export const Save = z.object({
  version: z.literal(1),
  levels: z.record(z.string(), LevelProgress),
  settings: Settings,
  settingsUpdatedAt: z.iso.datetime(),
});
export type Save = z.infer<typeof Save>;

export const DEFAULT_SETTINGS: Settings = { music: 60, sfx: 80, speed: 1, reducedShake: false };

export function emptySave(now = new Date(0).toISOString()): Save {
  return { version: 1, levels: {}, settings: { ...DEFAULT_SETTINGS }, settingsUpdatedAt: now };
}

/**
 * Merges two saves without ever losing progress: per level the best stars and score win,
 * and the most recently changed settings win.
 */
export function mergeSaves(a: Save, b: Save): Save {
  const levels: Record<string, LevelProgress> = { ...a.levels };
  for (const [id, p] of Object.entries(b.levels)) {
    const q = levels[id];
    levels[id] = q
      ? { stars: Math.max(p.stars, q.stars), bestScore: Math.max(p.bestScore, q.bestScore) }
      : p;
  }
  const newer = a.settingsUpdatedAt >= b.settingsUpdatedAt ? a : b;
  return {
    version: 1,
    levels,
    settings: newer.settings,
    settingsUpdatedAt: newer.settingsUpdatedAt,
  };
}
