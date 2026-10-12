import { type BotOptions, playBotGame } from './bot';
import { isBuildable, type Level, pointOnPath } from './level';
import { UNITS_PER_TILE } from './math';
import { runReplay, type Outcome } from './replay';

export const MIN_PATH_TILES = 15;
export const MAX_PATH_TILES = 120;
export const MIN_BUILDABLE_TILES = 25;

/**
 * A competent mixed strategy. Every campaign map must be beatable with 3 stars by it,
 * which keeps maps fair as content changes.
 */
export const REFERENCE_BOT: BotOptions = {
  mix: ['archer', 'mage', 'cannon', 'frost', 'archer', 'mage', 'cannon', 'archer'],
  maxTowers: 10,
  maxLevel: 3,
  branch: { archer: 1, cannon: 0, mage: 1, frost: 0 },
  callEarly: false,
};

/** A lazy strategy (three basic archers). It must not reach 3 stars: maps need some thought. */
export const WEAK_BOT: BotOptions = {
  mix: ['archer'],
  maxTowers: 3,
  maxLevel: 1,
  callEarly: false,
};

export const VALIDATION_SEEDS = [1, 2, 3];

/** Structural checks on a level: paths, build space and waves. Returns problems found. */
export function checkLevel(level: Level): string[] {
  const issues: string[] = [];
  const w = level.width * UNITS_PER_TILE;
  const h = level.height * UNITS_PER_TILE;
  const outside = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h;

  level.paths.forEach((path, i) => {
    const first = path.segments[0]!;
    const last = path.segments[path.segments.length - 1]!;
    if (!outside(first.ax, first.ay)) issues.push(`path ${i} must start off the map`);
    if (!outside(last.bx, last.by)) issues.push(`path ${i} must end off the map`);
    const tiles = path.length / UNITS_PER_TILE;
    if (tiles < MIN_PATH_TILES || tiles > MAX_PATH_TILES) {
      issues.push(
        `path ${i} is ${tiles.toFixed(1)} tiles long (allowed ${MIN_PATH_TILES}-${MAX_PATH_TILES})`,
      );
    }
    for (let d = 0; d < path.length; d += UNITS_PER_TILE / 4) {
      const p = pointOnPath(path, d, 0);
      const tx = Math.floor(p.x / UNITS_PER_TILE);
      const ty = Math.floor(p.y / UNITS_PER_TILE);
      if (isBuildable(level, tx, ty)) {
        issues.push(`path ${i} crosses buildable tile (${tx},${ty})`);
        break;
      }
    }
  });

  const buildable = level.buildable.filter(Boolean).length;
  if (buildable < MIN_BUILDABLE_TILES) {
    issues.push(`only ${buildable} buildable tiles (need ${MIN_BUILDABLE_TILES})`);
  }
  const lastWave = level.waves[level.waves.length - 1]!;
  if (!lastWave.groups.some((g) => g.enemy === 'warlord')) {
    issues.push('the final wave must include the warlord');
  }
  return issues;
}

export interface BotResult {
  seed: number;
  outcome: Outcome;
}

export function playBot(level: Level, bot: BotOptions, seeds = VALIDATION_SEEDS): BotResult[] {
  return seeds.map((seed) => {
    const result = runReplay(level, playBotGame(level, seed, bot));
    if (!result.ok) throw new Error(`${level.id}: bot replay failed: ${result.reason}`);
    return { seed, outcome: result.outcome };
  });
}

/** Balance checks: the reference bot 3-stars every seed and the weak bot never does. */
export function checkBalance(level: Level): string[] {
  const issues: string[] = [];
  for (const { seed, outcome } of playBot(level, REFERENCE_BOT)) {
    if (outcome.stars < 3) {
      issues.push(
        `reference bot got ${outcome.stars} stars (${outcome.lives} lives) on seed ${seed}`,
      );
    }
  }
  for (const { seed, outcome } of playBot(level, WEAK_BOT)) {
    if (outcome.stars === 3) issues.push(`weak bot got 3 stars on seed ${seed}`);
  }
  return issues;
}
