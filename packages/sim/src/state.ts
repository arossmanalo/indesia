import { ECONOMY_STATS } from './content/compiled';
import type { EnemyType, TargetMode, TowerType } from './content/schema';
import type { Level } from './level';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface Tower {
  id: number;
  type: TowerType;
  tx: number;
  ty: number;
  x: number;
  y: number;
  /** 1, 2 or 3. */
  level: number;
  /** Specialization at level 3: 0 or 1; -1 before that. */
  spec: number;
  targeting: TargetMode;
  cooldown: number;
  /** Total gold spent on this tower (for sell refunds). */
  spent: number;
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  path: number;
  segment: number;
  /** Distance travelled along the path. */
  progress: number;
  x: number;
  y: number;
  slowPct: number;
  slowTicks: number;
  healCooldown: number;
  /** Index of the wave that spawned it. */
  wave: number;
}

export interface Projectile {
  id: number;
  towerType: TowerType;
  x: number;
  y: number;
  targetId: number;
  /** Last known target position; the projectile lands here if the target dies. */
  tx: number;
  ty: number;
  speed: number;
  damage: number;
  magic: boolean;
  splash: number;
  slowPct: number;
  slowTicks: number;
  hitsAir: boolean;
  hitsGround: boolean;
}

export interface SpawnCursor {
  wave: number;
  group: number;
  spawned: number;
  nextTick: number;
}

/** Things that happened during the last tick, for rendering and audio only (not hashed). */
export type GameEvent =
  | { type: 'build'; towerId: number }
  | { type: 'upgrade'; towerId: number }
  | { type: 'sell'; towerId: number; tx: number; ty: number; refund: number }
  | { type: 'fire'; towerId: number; towerType: TowerType; projectileId: number }
  | {
      type: 'hit';
      projectileId: number;
      x: number;
      y: number;
      splash: number;
      towerType: TowerType;
    }
  | { type: 'kill'; enemyId: number; enemyType: EnemyType; x: number; y: number; bounty: number }
  | { type: 'leak'; enemyId: number; lifeCost: number }
  | { type: 'heal'; enemyId: number; x: number; y: number }
  | { type: 'waveStart'; wave: number; early: boolean; bonus: number }
  | { type: 'waveClear'; wave: number; bonus: number }
  | { type: 'end'; status: GameStatus };

export interface GameStats {
  killGold: number;
  earlyCallGold: number;
  waveBonusGold: number;
  enemiesKilled: number;
  enemiesLeaked: number;
  towersBuilt: number;
  /** Lives lost during each wave (indexed by wave). */
  livesLostPerWave: number[];
}

export interface GameState {
  tick: number;
  status: GameStatus;
  rng: number;
  nextId: number;
  gold: number;
  lives: number;
  /** Number of waves started so far. */
  wavesStarted: number;
  /** Ticks until the next wave starts automatically; -1 when not counting down. */
  nextWaveIn: number;
  /** Enemies of each wave not yet killed or leaked (including unspawned ones). */
  waveRemaining: number[];
  spawns: SpawnCursor[];
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  stats: GameStats;
  events: GameEvent[];
}

export interface Game {
  level: Level;
  state: GameState;
}

export function createGame(level: Level, seed: number): Game {
  return {
    level,
    state: {
      tick: 0,
      status: 'playing',
      rng: seed | 0,
      nextId: 1,
      gold: level.startingGold,
      lives: ECONOMY_STATS.startingLives,
      wavesStarted: 0,
      nextWaveIn: -1,
      waveRemaining: level.waves.map((w) => w.enemyCount),
      spawns: [],
      towers: [],
      enemies: [],
      projectiles: [],
      stats: {
        killGold: 0,
        earlyCallGold: 0,
        waveBonusGold: 0,
        enemiesKilled: 0,
        enemiesLeaked: 0,
        towersBuilt: 0,
        livesLostPerWave: level.waves.map(() => 0),
      },
      events: [],
    },
  };
}
