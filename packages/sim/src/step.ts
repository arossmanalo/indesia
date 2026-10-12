import { Hasher } from './hash';
import type { Game, GameState } from './state';
import { cleanupDead, healEnemies, moveEnemies } from './systems/enemies';
import { updateProjectiles } from './systems/projectiles';
import { updateTowers } from './systems/towers';
import { settleWaves, updateWaves } from './systems/waves';

/**
 * Advances the game by one tick. Commands for this tick must be applied (applyCommand)
 * before calling step; their events are kept and returned with this tick's events.
 */
export function step(game: Game): void {
  const { state, level } = game;
  if (state.status !== 'playing') return;

  updateWaves(game);
  moveEnemies(game);
  healEnemies(game);
  updateTowers(game);
  updateProjectiles(game);
  cleanupDead(game);
  settleWaves(game);

  if (state.lives <= 0) {
    state.status = 'lost';
  } else if (
    state.wavesStarted === level.waves.length &&
    state.spawns.length === 0 &&
    state.enemies.length === 0
  ) {
    state.status = 'won';
  }
  if (state.status !== 'playing') state.events.push({ type: 'end', status: state.status });

  state.tick++;
}

/** Clears the event list; call once the renderer has consumed a tick's events. */
export function clearEvents(state: GameState): void {
  state.events.length = 0;
}

/** Hash of everything that determines the future of the game. */
export function hashState(state: GameState): string {
  const h = new Hasher()
    .int(state.tick)
    .str(state.status)
    .int(state.rng)
    .int(state.nextId)
    .int(state.gold)
    .int(state.lives)
    .int(state.wavesStarted)
    .int(state.nextWaveIn);
  for (const r of state.waveRemaining) h.int(r);
  for (const c of state.spawns) h.int(c.wave).int(c.group).int(c.spawned).int(c.nextTick);
  for (const t of state.towers) {
    h.int(t.id).str(t.type).int(t.tx).int(t.ty).int(t.level).int(t.spec).str(t.targeting);
    h.int(t.cooldown).int(t.spent);
  }
  for (const e of state.enemies) {
    h.int(e.id).str(e.type).int(e.hp).int(e.path).int(e.progress).int(e.x).int(e.y);
    h.int(e.slowPct).int(e.slowTicks).int(e.healCooldown);
  }
  for (const p of state.projectiles) {
    h.int(p.id).int(p.x).int(p.y).int(p.targetId).int(p.tx).int(p.ty).int(p.damage);
  }
  return h.hex();
}
