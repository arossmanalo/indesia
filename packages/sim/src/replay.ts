import { z } from 'zod';
import { applyCommand, TimedCommand } from './commands';
import { ECONOMY_STATS } from './content/compiled';
import type { Level } from './level';
import { TICK_RATE } from './math';
import { clearEvents, hashState, step } from './step';
import { createGame, type Game, type GameStatus } from './state';
import { SIM_VERSION } from './version';

/** Hard stop for replays: one hour of game time. */
export const MAX_REPLAY_TICKS = 60 * 60 * TICK_RATE;
export const MAX_REPLAY_COMMANDS = 5000;

export const Replay = z.object({
  simVersion: z.number().int().positive(),
  levelId: z.string(),
  levelHash: z.string(),
  seed: z.number().int(),
  commands: z.array(TimedCommand).max(MAX_REPLAY_COMMANDS),
});
export type Replay = z.infer<typeof Replay>;

export interface Outcome {
  status: GameStatus;
  tick: number;
  lives: number;
  stars: number;
  score: number;
  hash: string;
}

export type ReplayResult =
  { ok: true; outcome: Outcome } | { ok: false; reason: string; outcome?: Outcome };

export function starsFor(status: GameStatus, lives: number): number {
  if (status !== 'won') return 0;
  if (lives >= 18) return 3;
  if (lives >= 10) return 2;
  return 1;
}

/** Final score: rewards lives kept, enemies slain and waves called early. */
export function scoreFor(game: Game): number {
  const { state } = game;
  if (state.status !== 'won') return 0;
  const livesPart = Math.trunc((state.lives * 5000) / ECONOMY_STATS.startingLives);
  return livesPart + state.stats.killGold * 10 + state.stats.earlyCallGold * 20;
}

export function outcomeOf(game: Game): Outcome {
  const { state } = game;
  return {
    status: state.status,
    tick: state.tick,
    lives: state.lives,
    stars: starsFor(state.status, state.lives),
    score: scoreFor(game),
    hash: hashState(state),
  };
}

/**
 * Re-runs a game from its command log. Every command must be valid at its tick: an honest
 * client only records commands that succeeded, so an invalid one means tampering.
 */
export function runReplay(level: Level, replay: Replay): ReplayResult {
  if (replay.simVersion !== SIM_VERSION) return { ok: false, reason: 'sim version mismatch' };
  if (replay.levelId !== level.id) return { ok: false, reason: 'level mismatch' };
  if (replay.levelHash !== level.hash) return { ok: false, reason: 'level content mismatch' };

  const game = createGame(level, replay.seed);
  let next = 0;
  while (game.state.status === 'playing' && game.state.tick < MAX_REPLAY_TICKS) {
    while (next < replay.commands.length && replay.commands[next]!.tick === game.state.tick) {
      const { tick: _tick, ...cmd } = replay.commands[next]!;
      const result = applyCommand(game, cmd);
      if (!result.ok) {
        return {
          ok: false,
          reason: `invalid command #${next} at tick ${game.state.tick}: ${result.reason}`,
          outcome: outcomeOf(game),
        };
      }
      next++;
    }
    if (next < replay.commands.length && replay.commands[next]!.tick < game.state.tick) {
      return { ok: false, reason: `command #${next} is out of order` };
    }
    step(game);
    clearEvents(game.state);
  }
  if (next < replay.commands.length) return { ok: false, reason: 'commands after the game ended' };
  if (game.state.status === 'playing') return { ok: false, reason: 'game did not finish' };
  return { ok: true, outcome: outcomeOf(game) };
}
