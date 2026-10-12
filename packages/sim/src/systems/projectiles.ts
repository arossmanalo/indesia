import { enemyStats } from '../content/compiled';
import { dist2, isqrt } from '../math';
import type { Enemy, Game, Projectile } from '../state';
import { damageEnemy, slowEnemy } from './enemies';

function affects(p: Projectile, enemy: Enemy): boolean {
  if (enemy.hp <= 0) return false;
  return enemyStats(enemy.type).flying ? p.hitsAir : p.hitsGround;
}

function hitEnemy(game: Game, p: Projectile, enemy: Enemy): void {
  if (p.slowPct > 0) slowEnemy(enemy, p.slowPct, p.slowTicks);
  damageEnemy(game, enemy, p.damage, p.magic);
}

function impact(game: Game, p: Projectile, target: Enemy | undefined): void {
  const { state } = game;
  state.events.push({
    type: 'hit',
    projectileId: p.id,
    x: p.tx,
    y: p.ty,
    splash: p.splash,
    towerType: p.towerType,
  });
  if (p.splash > 0) {
    const r2 = p.splash * p.splash;
    for (const enemy of state.enemies) {
      if (affects(p, enemy) && dist2(p.tx, p.ty, enemy.x, enemy.y) <= r2) hitEnemy(game, p, enemy);
    }
  } else if (target && target.hp > 0) {
    hitEnemy(game, p, target);
  }
}

export function updateProjectiles(game: Game): void {
  const { state } = game;
  const flying: Projectile[] = [];

  for (const p of state.projectiles) {
    const target = state.enemies.find((e) => e.id === p.targetId && e.hp > 0);
    if (target) {
      p.tx = target.x;
      p.ty = target.y;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = isqrt(dx * dx + dy * dy);
    if (dist <= p.speed) {
      p.x = p.tx;
      p.y = p.ty;
      impact(game, p, target);
      continue;
    }
    p.x += Math.trunc((dx * p.speed) / dist);
    p.y += Math.trunc((dy * p.speed) / dist);
    flying.push(p);
  }
  state.projectiles = flying;
}
