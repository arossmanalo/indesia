import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { enemyStats, towerStats } from './content/compiled';
import type { EnemyType } from './content/schema';
import { pointOnPath } from './level';
import { getLevel } from './levels';
import { UNITS_PER_TILE } from './math';
import { clearEvents, step } from './step';
import { createGame, type Enemy, type Game } from './state';
import { damageEnemy, slowEnemy } from './systems/enemies';

const level = getLevel('meadow')!;

/** Puts an enemy on the path `tiles` tiles from the start. */
function spawn(game: Game, type: EnemyType, tiles: number): Enemy {
  const stats = enemyStats(type);
  const progress = Math.round(tiles * UNITS_PER_TILE);
  const pos = pointOnPath(level.paths[0]!, progress, 0);
  const enemy: Enemy = {
    id: game.state.nextId++,
    type,
    hp: stats.hp,
    maxHp: stats.hp,
    path: 0,
    segment: pos.segment,
    progress,
    x: pos.x,
    y: pos.y,
    slowPct: 0,
    slowTicks: 0,
    healCooldown: stats.healEvery,
    wave: 0,
  };
  game.state.enemies.push(enemy);
  game.state.waveRemaining[0]!++;
  return enemy;
}

function run(game: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    step(game);
    clearEvents(game.state);
  }
}

function freshGame(): Game {
  const game = createGame(level, 1);
  game.state.gold = 10_000;
  return game;
}

describe('damage types', () => {
  it('armor reduces physical damage but not magic', () => {
    const game = freshGame();
    const knight = spawn(game, 'knight', 3);
    damageEnemy(game, knight, 10, false);
    expect(knight.maxHp - knight.hp).toBe(4); // 60% armor
    const hp = knight.hp;
    damageEnemy(game, knight, 10, true);
    expect(hp - knight.hp).toBe(10);
  });

  it('magic resist reduces magic damage but not physical', () => {
    const game = freshGame();
    const wraith = spawn(game, 'wraith', 3);
    damageEnemy(game, wraith, 10, true);
    expect(wraith.maxHp - wraith.hp).toBe(3); // 70% magic resist
    const hp = wraith.hp;
    damageEnemy(game, wraith, 10, false);
    expect(hp - wraith.hp).toBe(10);
  });

  it('always deals at least 1 damage', () => {
    const game = freshGame();
    const knight = spawn(game, 'knight', 3);
    damageEnemy(game, knight, 1, false);
    expect(knight.hp).toBe(knight.maxHp - 1);
  });
});

describe('targeting rules', () => {
  it('cannons ignore flyers while archers shoot them', () => {
    const game = freshGame();
    applyCommand(game, { type: 'build', tower: 'cannon', tx: 5, ty: 2 });
    const bat = spawn(game, 'bat', 4.5);
    run(game, 5);
    expect(game.state.projectiles).toHaveLength(0);
    expect(bat.hp).toBe(bat.maxHp);

    applyCommand(game, { type: 'build', tower: 'archer', tx: 3, ty: 2 });
    run(game, 10);
    expect(bat.hp).toBeLessThan(bat.maxHp);
  });

  it('splash damages every ground enemy in the blast', () => {
    const game = freshGame();
    applyCommand(game, { type: 'build', tower: 'cannon', tx: 5, ty: 3 });
    const a = spawn(game, 'grunt', 6);
    const b = spawn(game, 'grunt', 6.3);
    run(game, 40);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
  });

  it('multi-shot towers hit different targets', () => {
    const game = freshGame();
    applyCommand(game, { type: 'build', tower: 'mage', tx: 5, ty: 3 });
    const id = game.state.towers[0]!.id;
    applyCommand(game, { type: 'upgrade', towerId: id });
    applyCommand(game, { type: 'upgrade', towerId: id, branch: 1 }); // Storm Tower
    spawn(game, 'grunt', 5);
    spawn(game, 'grunt', 6);
    spawn(game, 'grunt', 7);
    run(game, 1);
    const targets = new Set(game.state.projectiles.map((p) => p.targetId));
    expect(targets.size).toBe(3);
  });
});

describe('slows', () => {
  it('frost slows enemies down', () => {
    const game = freshGame();
    applyCommand(game, { type: 'build', tower: 'frost', tx: 5, ty: 3 });
    const grunt = spawn(game, 'grunt', 5);
    run(game, 15);
    expect(grunt.slowPct).toBe(towerStats('frost')[0].slowPct);
    const before = grunt.progress;
    run(game, 1);
    expect(grunt.progress - before).toBeLessThan(enemyStats('grunt').speed);
  });

  it('the warlord shrugs off half of every slow', () => {
    const game = freshGame();
    const boss = spawn(game, 'warlord', 3);
    slowEnemy(boss, 40, 30);
    expect(boss.slowPct).toBe(20);
  });

  it('a stronger slow replaces a weaker one', () => {
    const game = freshGame();
    const grunt = spawn(game, 'grunt', 3);
    slowEnemy(grunt, 30, 10);
    slowEnemy(grunt, 55, 5);
    expect(grunt.slowPct).toBe(55);
    slowEnemy(grunt, 30, 50);
    expect(grunt.slowPct).toBe(55);
  });
});

describe('shamans', () => {
  it('heal wounded allies nearby', () => {
    const game = freshGame();
    spawn(game, 'shaman', 3);
    const grunt = spawn(game, 'grunt', 3.5);
    grunt.hp = 10;
    run(game, 70);
    expect(grunt.hp).toBeGreaterThan(10);
  });
});
