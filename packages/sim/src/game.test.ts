import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { enemyStats, towerStats } from './content/compiled';
import { getLevel } from './levels';
import { clearEvents, step } from './step';
import { createGame, type Game } from './state';

const level = getLevel('meadow')!;

function run(game: Game, ticks: number): void {
  for (let i = 0; i < ticks && game.state.status === 'playing'; i++) {
    step(game);
    clearEvents(game.state);
  }
}

describe('building', () => {
  it('builds on grass and charges gold', () => {
    const game = createGame(level, 1);
    expect(applyCommand(game, { type: 'build', tower: 'archer', tx: 5, ty: 2 })).toEqual({
      ok: true,
    });
    expect(game.state.gold).toBe(level.startingGold - towerStats('archer')[0].cost);
    expect(game.state.towers).toHaveLength(1);
  });

  it('rejects the path, occupied tiles, blocked tiles and the map edge', () => {
    const game = createGame(level, 1);
    applyCommand(game, { type: 'build', tower: 'archer', tx: 5, ty: 2 });
    for (const [tx, ty] of [
      [4, 2], // path
      [5, 2], // occupied
      [0, 0], // tree
      [-1, 3],
      [20, 3],
    ] as const) {
      expect(applyCommand(game, { type: 'build', tower: 'archer', tx, ty }).ok).toBe(false);
    }
  });

  it('rejects building without enough gold', () => {
    const game = createGame(level, 1);
    game.state.gold = 10;
    expect(applyCommand(game, { type: 'build', tower: 'archer', tx: 5, ty: 2 })).toEqual({
      ok: false,
      reason: 'not enough gold',
    });
  });

  it('refunds 70% of everything spent when selling', () => {
    const game = createGame(level, 1);
    game.state.gold = 1000;
    applyCommand(game, { type: 'build', tower: 'archer', tx: 5, ty: 2 });
    const id = game.state.towers[0]!.id;
    applyCommand(game, { type: 'upgrade', towerId: id });
    const spent = towerStats('archer')[0].cost + towerStats('archer')[1].cost;
    const before = game.state.gold;
    applyCommand(game, { type: 'sell', towerId: id });
    expect(game.state.gold - before).toBe(Math.trunc((spent * 70) / 100));
    expect(game.state.towers).toHaveLength(0);
  });

  it('requires a specialization choice for the third level', () => {
    const game = createGame(level, 1);
    game.state.gold = 10_000;
    applyCommand(game, { type: 'build', tower: 'archer', tx: 5, ty: 2 });
    const id = game.state.towers[0]!.id;
    applyCommand(game, { type: 'upgrade', towerId: id });
    expect(applyCommand(game, { type: 'upgrade', towerId: id }).ok).toBe(false);
    expect(applyCommand(game, { type: 'upgrade', towerId: id, branch: 1 }).ok).toBe(true);
    expect(game.state.towers[0]).toMatchObject({ level: 3, spec: 1 });
    expect(applyCommand(game, { type: 'upgrade', towerId: id, branch: 0 }).ok).toBe(false);
  });
});

describe('waves', () => {
  it('waits for the player to call the first wave', () => {
    const game = createGame(level, 1);
    run(game, 300);
    expect(game.state.enemies).toHaveLength(0);
    expect(applyCommand(game, { type: 'callWave' }).ok).toBe(true);
    run(game, 1);
    expect(game.state.enemies).toHaveLength(1);
  });

  it('costs lives when enemies reach the exit undefended', () => {
    const game = createGame(level, 1);
    applyCommand(game, { type: 'callWave' });
    run(game, 60 * 30);
    const wave1 = level.waves[0]!.enemyCount;
    // Later waves start automatically, so look at the first wave's losses only.
    expect(game.state.stats.livesLostPerWave[0]).toBe(wave1 * enemyStats('grunt').lifeCost);
    expect(game.state.lives).toBeLessThan(20);
  });

  it('pays a bonus for calling the next wave early', () => {
    const game = createGame(level, 1);
    applyCommand(game, { type: 'callWave' });
    while (game.state.nextWaveIn < 0) run(game, 1);
    const gold = game.state.gold;
    expect(applyCommand(game, { type: 'callWave' }).ok).toBe(true);
    expect(game.state.gold).toBeGreaterThan(gold);
    expect(game.state.wavesStarted).toBe(2);
  });

  it('is lost when lives run out', () => {
    const game = createGame(level, 1);
    const think = () => {
      if (game.state.wavesStarted === 0 || game.state.nextWaveIn > 0)
        applyCommand(game, { type: 'callWave' });
    };
    while (game.state.status === 'playing') {
      think();
      run(game, 1);
    }
    expect(game.state.status).toBe('lost');
    expect(game.state.lives).toBe(0);
  });
});

describe('combat', () => {
  it('archers kill grunts and earn their bounty', () => {
    const game = createGame(level, 1);
    applyCommand(game, { type: 'build', tower: 'archer', tx: 5, ty: 2 });
    applyCommand(game, { type: 'build', tower: 'archer', tx: 3, ty: 2 });
    applyCommand(game, { type: 'callWave' });
    run(game, 40 * 30);
    expect(game.state.stats.enemiesKilled).toBeGreaterThan(0);
    expect(game.state.stats.killGold).toBe(
      game.state.stats.enemiesKilled * enemyStats('grunt').bounty,
    );
  });
});
