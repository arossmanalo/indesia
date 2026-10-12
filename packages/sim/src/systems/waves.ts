import { ECONOMY_STATS, enemyStats } from '../content/compiled';
import { pointOnPath } from '../level';
import type { Game } from '../state';

export function startNextWave(game: Game, early: boolean, bonus: number): void {
  const { state, level } = game;
  const wave = state.wavesStarted;
  const def = level.waves[wave]!;
  def.groups.forEach((g, group) => {
    state.spawns.push({ wave, group, spawned: 0, nextTick: state.tick + g.delayTicks });
  });
  state.wavesStarted++;
  state.nextWaveIn = -1;
  state.events.push({ type: 'waveStart', wave, early, bonus });
}

export function updateWaves(game: Game): void {
  const { state, level } = game;

  for (const cursor of state.spawns) {
    const wave = level.waves[cursor.wave]!;
    const group = wave.groups[cursor.group]!;
    while (cursor.spawned < group.count && state.tick >= cursor.nextTick) {
      const stats = enemyStats(group.enemy);
      const path = level.paths[group.path]!;
      const pos = pointOnPath(path, 0, 0);
      const hp = Math.max(1, Math.trunc((stats.hp * wave.hpPct) / 100));
      state.enemies.push({
        id: state.nextId++,
        type: group.enemy,
        hp,
        maxHp: hp,
        path: group.path,
        segment: pos.segment,
        progress: 0,
        x: pos.x,
        y: pos.y,
        slowPct: 0,
        slowTicks: 0,
        healCooldown: stats.healEvery,
        wave: cursor.wave,
      });
      cursor.spawned++;
      cursor.nextTick += group.intervalTicks;
    }
  }

  const before = state.spawns.length;
  state.spawns = state.spawns.filter(
    (c) => c.spawned < level.waves[c.wave]!.groups[c.group]!.count,
  );
  const finishedSpawning = before > 0 && state.spawns.length === 0;

  if (finishedSpawning && state.wavesStarted < level.waves.length) {
    state.nextWaveIn = ECONOMY_STATS.waveGapTicks;
  } else if (state.nextWaveIn > 0) {
    state.nextWaveIn--;
    if (state.nextWaveIn === 0) startNextWave(game, false, 0);
  }
}

/** Awards wave-clear bonuses once all enemies of a started wave are gone. */
export function settleWaves(game: Game): void {
  const { state, level } = game;
  for (let w = 0; w < state.wavesStarted; w++) {
    if (state.waveRemaining[w] === 0) {
      const bonus = level.waves[w]!.bonus;
      state.gold += bonus;
      state.stats.waveBonusGold += bonus;
      state.waveRemaining[w] = -1;
      state.events.push({ type: 'waveClear', wave: w, bonus });
    }
  }
}
