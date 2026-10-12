import {
  applyCommand,
  clearEvents,
  type Command,
  type CommandResult,
  createGame,
  type Game,
  type GameEvent,
  type Level,
  type Replay,
  SIM_VERSION,
  step,
  TICK_RATE,
  type TimedCommand,
} from '@indesia/sim';

export const STEP_MS = 1000 / TICK_RATE;
const MAX_FRAME_MS = 250;

export type Speed = 1 | 2 | 3;

/**
 * Runs one game: owns the simulation, advances it at a fixed tick rate scaled by the
 * game speed, and records every accepted command so the game can be replayed exactly.
 */
export class GameController {
  readonly game: Game;
  readonly commands: TimedCommand[] = [];
  speed: Speed;
  paused = false;
  private acc = 0;

  constructor(
    readonly level: Level,
    readonly seed: number,
    speed: Speed,
  ) {
    this.game = createGame(level, seed);
    this.speed = speed;
  }

  get state() {
    return this.game.state;
  }

  /** Applies a command at the current tick (before the next step) and records it. */
  issue(cmd: Command): CommandResult {
    const result = applyCommand(this.game, cmd);
    if (result.ok) this.commands.push({ tick: this.game.state.tick, ...cmd });
    return result;
  }

  /**
   * Advances by real elapsed time. `onStep` runs before each tick (to snapshot positions)
   * and `onEvents` after it with that tick's events. Returns the interpolation fraction
   * between the last two ticks.
   */
  advance(
    deltaMs: number,
    onStep: () => void,
    onEvents: (events: readonly GameEvent[]) => void,
  ): number {
    if (this.paused || this.game.state.status !== 'playing') {
      // Show events produced by commands issued while paused (e.g. building).
      if (this.game.state.events.length > 0) {
        onEvents(this.game.state.events);
        clearEvents(this.game.state);
      }
      return 1;
    }
    this.acc += Math.min(deltaMs, MAX_FRAME_MS) * this.speed;
    while (this.acc >= STEP_MS && this.game.state.status === 'playing') {
      onStep();
      step(this.game);
      onEvents(this.game.state.events);
      clearEvents(this.game.state);
      this.acc -= STEP_MS;
    }
    return this.acc / STEP_MS;
  }

  replay(): Replay {
    return {
      simVersion: SIM_VERSION,
      levelId: this.level.id,
      levelHash: this.level.hash,
      seed: this.seed,
      commands: this.commands,
    };
  }
}

export function randomSeed(): number {
  const buf = new Int32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]!;
}
