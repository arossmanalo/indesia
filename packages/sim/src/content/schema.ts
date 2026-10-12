import { z } from 'zod';

export const TOWER_TYPES = ['archer', 'cannon', 'mage', 'frost'] as const;
export const TowerType = z.enum(TOWER_TYPES);
export type TowerType = z.infer<typeof TowerType>;

export const ENEMY_TYPES = [
  'grunt',
  'runner',
  'knight',
  'wraith',
  'bat',
  'shaman',
  'warlord',
] as const;
export const EnemyType = z.enum(ENEMY_TYPES);
export type EnemyType = z.infer<typeof EnemyType>;

export const DamageType = z.enum(['physical', 'magic']);
export type DamageType = z.infer<typeof DamageType>;

export const TARGET_MODES = ['first', 'last', 'strongest', 'closest'] as const;
export const TargetMode = z.enum(TARGET_MODES);
export type TargetMode = z.infer<typeof TargetMode>;

const percent = z.number().int().min(0).max(100);

/** One tower level as authored, in friendly units (tiles, seconds, tiles per second). */
export const TowerLevelDef = z.object({
  name: z.string(),
  description: z.string(),
  /** Gold to build (level 1) or to upgrade into this level. */
  cost: z.number().int().positive(),
  damage: z.number().int().nonnegative(),
  damageType: DamageType,
  range: z.number().positive(),
  cooldown: z.number().positive(),
  projectileSpeed: z.number().positive(),
  targetsAir: z.boolean(),
  targetsGround: z.boolean(),
  splash: z.number().positive().optional(),
  slow: z.object({ pct: percent, duration: z.number().positive() }).optional(),
  shots: z.number().int().min(1).optional(),
  crit: z.object({ chance: percent, multiplier: z.number().int().min(2) }).optional(),
});
export type TowerLevelDef = z.infer<typeof TowerLevelDef>;

/** Levels 1 and 2 are linear; level 3 is one of two specializations. */
export const TowerDef = z.object({
  type: TowerType,
  levels: z.tuple([TowerLevelDef, TowerLevelDef]),
  specs: z.tuple([TowerLevelDef, TowerLevelDef]),
});
export type TowerDef = z.infer<typeof TowerDef>;

export const EnemyDef = z.object({
  type: EnemyType,
  name: z.string(),
  description: z.string(),
  hp: z.number().int().positive(),
  speed: z.number().positive(),
  armor: percent,
  magicResist: percent,
  bounty: z.number().int().nonnegative(),
  lifeCost: z.number().int().positive(),
  flying: z.boolean(),
  /** Slow effects on this enemy are reduced by this percentage. */
  slowResist: percent.default(0),
  heal: z
    .object({
      amount: z.number().int().positive(),
      radius: z.number().positive(),
      every: z.number().positive(),
    })
    .optional(),
});
export type EnemyDef = z.input<typeof EnemyDef>;

export const EconomyDef = z.object({
  startingLives: z.number().int().positive(),
  sellRefundPct: percent,
  /** Seconds between the end of one wave's spawning and the next wave starting. */
  waveGap: z.number().positive(),
  /** Gold per remaining whole second of the gap when the next wave is called early. */
  earlyCallGoldPerSecond: z.number().int().nonnegative(),
});
export type EconomyDef = z.infer<typeof EconomyDef>;
