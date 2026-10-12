import { secondsToTicks, tilesPerSecondToUnitsPerTick, tilesToUnits } from '../math';
import { ECONOMY } from './economy';
import { ENEMY_DEFS } from './enemies';
import {
  type DamageType,
  EconomyDef,
  EnemyDef,
  type EnemyType,
  TowerDef,
  type TowerLevelDef,
  type TowerType,
} from './schema';
import { TOWER_DEFS } from './towers';

/** A tower level converted to simulation units (units, ticks, units per tick). */
export interface TowerStats {
  name: string;
  cost: number;
  damage: number;
  damageType: DamageType;
  range: number;
  range2: number;
  cooldown: number;
  projectileSpeed: number;
  targetsAir: boolean;
  targetsGround: boolean;
  splash: number;
  slowPct: number;
  slowTicks: number;
  shots: number;
  critChance: number;
  critMultiplier: number;
}

export interface EnemyStats {
  type: EnemyType;
  hp: number;
  speed: number;
  armor: number;
  magicResist: number;
  bounty: number;
  lifeCost: number;
  flying: boolean;
  slowResist: number;
  healAmount: number;
  healRadius2: number;
  healEvery: number;
}

export interface EconomyStats {
  startingLives: number;
  sellRefundPct: number;
  waveGapTicks: number;
  earlyCallGoldPerSecond: number;
}

/** Index 0, 1 = levels 1 and 2; index 2, 3 = specializations A and B. */
export type TowerStatTable = readonly [TowerStats, TowerStats, TowerStats, TowerStats];

function compileLevel(def: TowerLevelDef): TowerStats {
  const range = tilesToUnits(def.range);
  return {
    name: def.name,
    cost: def.cost,
    damage: def.damage,
    damageType: def.damageType,
    range,
    range2: range * range,
    cooldown: Math.max(1, secondsToTicks(def.cooldown)),
    projectileSpeed: tilesPerSecondToUnitsPerTick(def.projectileSpeed),
    targetsAir: def.targetsAir,
    targetsGround: def.targetsGround,
    splash: def.splash === undefined ? 0 : tilesToUnits(def.splash),
    slowPct: def.slow?.pct ?? 0,
    slowTicks: def.slow === undefined ? 0 : secondsToTicks(def.slow.duration),
    shots: def.shots ?? 1,
    critChance: def.crit?.chance ?? 0,
    critMultiplier: def.crit?.multiplier ?? 1,
  };
}

function compileTowers(): Partial<Record<TowerType, TowerStatTable>> {
  const out: Partial<Record<TowerType, TowerStatTable>> = {};
  for (const raw of TOWER_DEFS) {
    const def = TowerDef.parse(raw);
    out[def.type] = [
      compileLevel(def.levels[0]),
      compileLevel(def.levels[1]),
      compileLevel(def.specs[0]),
      compileLevel(def.specs[1]),
    ];
  }
  return out;
}

function compileEnemies(): Partial<Record<EnemyType, EnemyStats>> {
  const out: Partial<Record<EnemyType, EnemyStats>> = {};
  for (const raw of ENEMY_DEFS) {
    const def = EnemyDef.parse(raw);
    const healRadius = def.heal === undefined ? 0 : tilesToUnits(def.heal.radius);
    out[def.type] = {
      type: def.type,
      hp: def.hp,
      speed: tilesPerSecondToUnitsPerTick(def.speed),
      armor: def.armor,
      magicResist: def.magicResist,
      bounty: def.bounty,
      lifeCost: def.lifeCost,
      flying: def.flying,
      slowResist: def.slowResist,
      healAmount: def.heal?.amount ?? 0,
      healRadius2: healRadius * healRadius,
      healEvery: def.heal === undefined ? 0 : secondsToTicks(def.heal.every),
    };
  }
  return out;
}

const towers = compileTowers();
const enemies = compileEnemies();
const economy = EconomyDef.parse(ECONOMY);

export const ECONOMY_STATS: EconomyStats = {
  startingLives: economy.startingLives,
  sellRefundPct: economy.sellRefundPct,
  waveGapTicks: secondsToTicks(economy.waveGap),
  earlyCallGoldPerSecond: economy.earlyCallGoldPerSecond,
};

export function hasTower(type: TowerType): boolean {
  return towers[type] !== undefined;
}

export function hasEnemy(type: EnemyType): boolean {
  return enemies[type] !== undefined;
}

export function towerStats(type: TowerType): TowerStatTable {
  const table = towers[type];
  if (!table) throw new Error(`Unknown tower type: ${type}`);
  return table;
}

export function enemyStats(type: EnemyType): EnemyStats {
  const stats = enemies[type];
  if (!stats) throw new Error(`Unknown enemy type: ${type}`);
  return stats;
}

/** Index into a TowerStatTable for a tower's level (1-3) and specialization (0/1). */
export function statIndex(level: number, spec: number): 0 | 1 | 2 | 3 {
  if (level === 1) return 0;
  if (level === 2) return 1;
  return spec === 1 ? 3 : 2;
}
