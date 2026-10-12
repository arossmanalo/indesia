import { applyCommand, type Command, type TimedCommand, upgradeCost } from './commands';
import { towerStats } from './content/compiled';
import type { TowerType } from './content/schema';
import { isBuildable, type Level, pointOnPath } from './level';
import { dist2, tileCenter, UNITS_PER_TILE } from './math';
import type { Replay } from './replay';
import { clearEvents, step } from './step';
import { createGame, type Game } from './state';
import { SIM_VERSION } from './version';
import { MAX_REPLAY_TICKS } from './replay';

/**
 * A simple deterministic player used for golden replays and the balance script.
 * It builds towers on the tiles that cover the most path, cycling through `mix`,
 * and upgrades the best-placed towers once `maxTowers` are standing.
 */
export interface BotOptions {
  mix: TowerType[];
  maxTowers: number;
  /** Highest level the bot upgrades to (1 = never upgrade). */
  maxLevel: number;
  /** Specialization branch chosen at level 3, per tower type. */
  branch?: Partial<Record<TowerType, 0 | 1>>;
  /** Call waves early as soon as the countdown starts. */
  callEarly: boolean;
}

interface Spot {
  tx: number;
  ty: number;
  coverage: number;
}

/** Path sample points every quarter tile, shared by coverage calculations. */
function pathSamples(level: Level): { x: number; y: number }[] {
  const samples: { x: number; y: number }[] = [];
  for (const path of level.paths) {
    for (let d = 0; d < path.length; d += UNITS_PER_TILE / 4) {
      samples.push(pointOnPath(path, d, 0));
    }
  }
  return samples;
}

export function rankSpots(level: Level, range2: number): Spot[] {
  const samples = pathSamples(level);
  const spots: Spot[] = [];
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      if (!isBuildable(level, tx, ty)) continue;
      const cx = tileCenter(tx);
      const cy = tileCenter(ty);
      const coverage = samples.filter((s) => dist2(cx, cy, s.x, s.y) <= range2).length;
      if (coverage > 0) spots.push({ tx, ty, coverage });
    }
  }
  return spots.sort((a, b) => b.coverage - a.coverage || a.ty - b.ty || a.tx - b.tx);
}

export function createBot(level: Level, options: BotOptions) {
  const spotsByType = new Map<TowerType, Spot[]>();
  for (const type of new Set(options.mix)) {
    spotsByType.set(type, rankSpots(level, towerStats(type)[0].range2));
  }
  let built = 0;

  /** Returns the commands the bot wants to issue this tick (already applied to `game`). */
  return function think(game: Game): Command[] {
    const issued: Command[] = [];
    const tryCommand = (cmd: Command) => {
      if (applyCommand(game, cmd).ok) issued.push(cmd);
    };
    const { state } = game;

    // Build until the tower budget is used.
    while (state.towers.length < options.maxTowers) {
      const type = options.mix[built % options.mix.length]!;
      if (state.gold < towerStats(type)[0].cost) break;
      const spot = spotsByType
        .get(type)!
        .find((s) => !state.towers.some((t) => t.tx === s.tx && t.ty === s.ty));
      if (!spot) break;
      tryCommand({ type: 'build', tower: type, tx: spot.tx, ty: spot.ty });
      built++;
    }

    // Then upgrade, oldest (best-placed) towers first.
    if (state.towers.length >= options.maxTowers) {
      for (const tower of [...state.towers]) {
        if (tower.level >= options.maxLevel) continue;
        const branch = options.branch?.[tower.type] ?? 0;
        const cost = upgradeCost(game, tower.id, branch);
        if (cost === null || state.gold < cost) break;
        tryCommand(
          tower.level === 2
            ? { type: 'upgrade', towerId: tower.id, branch }
            : { type: 'upgrade', towerId: tower.id },
        );
      }
    }

    if (state.wavesStarted === 0 || (options.callEarly && state.nextWaveIn > 0)) {
      tryCommand({ type: 'callWave' });
    }
    return issued;
  };
}

/** Plays a whole game with the bot and returns its replay. */
export function playBotGame(level: Level, seed: number, options: BotOptions): Replay {
  const game = createGame(level, seed);
  const think = createBot(level, options);
  const commands: TimedCommand[] = [];
  while (game.state.status === 'playing' && game.state.tick < MAX_REPLAY_TICKS) {
    for (const cmd of think(game)) commands.push({ tick: game.state.tick, ...cmd });
    step(game);
    clearEvents(game.state);
  }
  return { simVersion: SIM_VERSION, levelId: level.id, levelHash: level.hash, seed, commands };
}
