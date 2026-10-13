import { enemyStats, statIndex, towerStats, type TowerStats } from '../content/compiled';
import type { TargetMode } from '../content/schema';
import { dist2 } from '../math';
import { rollPercent } from '../rng';
import type { Enemy, Game, Tower } from '../state';

export function currentStats(tower: Tower): TowerStats {
  return towerStats(tower.type)[statIndex(tower.level, tower.spec)];
}

function canTarget(stats: TowerStats, enemy: Enemy): boolean {
  if (enemy.hp <= 0) return false;
  return enemyStats(enemy.type).flying ? stats.targetsAir : stats.targetsGround;
}

/** True if `a` should be preferred over `b`. Ties fall back to the lower id. */
function better(mode: TargetMode, tower: Tower, a: Enemy, b: Enemy): boolean {
  let diff = 0;
  switch (mode) {
    case 'first':
      diff = a.progress - b.progress;
      break;
    case 'last':
      diff = b.progress - a.progress;
      break;
    case 'strongest':
      diff = a.hp - b.hp || a.progress - b.progress;
      break;
    case 'closest':
      diff = dist2(tower.x, tower.y, b.x, b.y) - dist2(tower.x, tower.y, a.x, a.y);
      break;
  }
  return diff > 0 || (diff === 0 && a.id < b.id);
}

/** Picks up to `count` distinct targets in range, best first. */
export function pickTargets(game: Game, tower: Tower, stats: TowerStats, count: number): Enemy[] {
  const picked: Enemy[] = [];
  for (let n = 0; n < count; n++) {
    let best: Enemy | undefined;
    for (const enemy of game.state.enemies) {
      if (picked.includes(enemy) || !canTarget(stats, enemy)) continue;
      if (dist2(tower.x, tower.y, enemy.x, enemy.y) > stats.range2) continue;
      if (!best || better(tower.targeting, tower, enemy, best)) best = enemy;
    }
    if (!best) break;
    picked.push(best);
  }
  return picked;
}

export function updateTowers(game: Game): void {
  const { state } = game;
  for (const tower of state.towers) {
    if (tower.cooldown > 0) {
      tower.cooldown--;
      continue;
    }
    const stats = currentStats(tower);
    const targets = pickTargets(game, tower, stats, stats.shots);
    if (targets.length === 0) continue;

    for (const target of targets) {
      const crit = stats.critChance > 0 && rollPercent(state, stats.critChance);
      const id = state.nextId++;
      state.projectiles.push({
        id,
        towerType: tower.type,
        x: tower.x,
        y: tower.y,
        targetId: target.id,
        tx: target.x,
        ty: target.y,
        speed: stats.projectileSpeed,
        damage: crit ? stats.damage * stats.critMultiplier : stats.damage,
        magic: stats.damageType === 'magic',
        splash: stats.splash,
        slowPct: stats.slowPct,
        slowTicks: stats.slowTicks,
        hitsAir: stats.targetsAir,
        hitsGround: stats.targetsGround,
      });
      state.events.push({
        type: 'fire',
        towerId: tower.id,
        towerType: tower.type,
        projectileId: id,
      });
    }
    tower.cooldown = stats.cooldown - 1;
  }
}
