import { enemyStats } from '../content/compiled';
import { pointOnPath } from '../level';
import { dist2, percentOf } from '../math';
import type { Enemy, Game } from '../state';

function removeEnemy(game: Game, enemy: Enemy): void {
  const { state } = game;
  state.waveRemaining[enemy.wave]!--;
}

export function moveEnemies(game: Game): void {
  const { state, level } = game;
  const survivors: Enemy[] = [];

  for (const enemy of state.enemies) {
    const stats = enemyStats(enemy.type);
    let speed = stats.speed;
    if (enemy.slowTicks > 0) {
      speed -= percentOf(speed, enemy.slowPct);
      enemy.slowTicks--;
      if (enemy.slowTicks === 0) enemy.slowPct = 0;
    }
    enemy.progress += Math.max(1, speed);

    const path = level.paths[enemy.path]!;
    if (enemy.progress >= path.length) {
      state.lives = Math.max(0, state.lives - stats.lifeCost);
      state.stats.enemiesLeaked++;
      state.stats.livesLostPerWave[enemy.wave]! += stats.lifeCost;
      state.events.push({ type: 'leak', enemyId: enemy.id, lifeCost: stats.lifeCost });
      removeEnemy(game, enemy);
      continue;
    }
    const pos = pointOnPath(path, enemy.progress, enemy.segment);
    enemy.x = pos.x;
    enemy.y = pos.y;
    enemy.segment = pos.segment;
    survivors.push(enemy);
  }
  state.enemies = survivors;
}

export function healEnemies(game: Game): void {
  const { state } = game;
  for (const healer of state.enemies) {
    const stats = enemyStats(healer.type);
    if (stats.healAmount === 0) continue;
    if (--healer.healCooldown > 0) continue;
    healer.healCooldown = stats.healEvery;
    for (const other of state.enemies) {
      if (other.hp >= other.maxHp) continue;
      if (dist2(healer.x, healer.y, other.x, other.y) > stats.healRadius2) continue;
      other.hp = Math.min(other.maxHp, other.hp + stats.healAmount);
      state.events.push({ type: 'heal', enemyId: other.id, x: other.x, y: other.y });
    }
  }
}

/** Applies damage after armor or magic resist. Returns true if the enemy died. */
export function damageEnemy(game: Game, enemy: Enemy, damage: number, magic: boolean): boolean {
  if (enemy.hp <= 0) return false;
  const stats = enemyStats(enemy.type);
  const resist = magic ? stats.magicResist : stats.armor;
  const dealt = Math.max(1, damage - percentOf(damage, resist));
  enemy.hp -= dealt;
  if (enemy.hp > 0) return false;

  const { state } = game;
  state.gold += stats.bounty;
  state.stats.killGold += stats.bounty;
  state.stats.enemiesKilled++;
  state.events.push({
    type: 'kill',
    enemyId: enemy.id,
    enemyType: enemy.type,
    x: enemy.x,
    y: enemy.y,
    bounty: stats.bounty,
  });
  return true;
}

export function slowEnemy(enemy: Enemy, pct: number, ticks: number): void {
  const resisted = pct - percentOf(pct, enemyStats(enemy.type).slowResist);
  if (resisted > enemy.slowPct) enemy.slowPct = resisted;
  if (resisted >= enemy.slowPct && ticks > enemy.slowTicks) enemy.slowTicks = ticks;
}

/** Removes enemies killed this tick. */
export function cleanupDead(game: Game): void {
  const { state } = game;
  state.enemies = state.enemies.filter((e) => {
    if (e.hp > 0) return true;
    removeEnemy(game, e);
    return false;
  });
}
