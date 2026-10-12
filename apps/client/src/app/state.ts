import type { Save } from '@indesia/shared';
import type { EnemyType, GameStatus, TargetMode, TowerType } from '@indesia/sim';
import { createStore } from '../ui/store';
import { loadSave } from './save';

export type Screen = 'loading' | 'title' | 'levels' | 'leaderboard' | 'battle';

export type SubmitStatus =
  | { state: 'pending' }
  | { state: 'queued' }
  | { state: 'verified'; rank: number }
  | { state: 'rejected'; reason: string };

export interface Online {
  status: 'connecting' | 'online' | 'offline';
  name: string | null;
  guest: boolean;
  providers: ('github' | 'google')[];
}

export interface Hud {
  gold: number;
  lives: number;
  wave: number;
  waves: number;
  /** Whole seconds until the next wave starts on its own; -1 when not counting down. */
  nextWaveIn: number;
  canCallWave: boolean;
  callBonus: number;
  /** Enemies of the next wave, grouped by type. */
  nextWave: { enemy: EnemyType; count: number }[];
  status: GameStatus;
}

export interface UpgradeOption {
  branch?: 0 | 1;
  name: string;
  description: string;
  cost: number;
  affordable: boolean;
}

export interface SelectedTower {
  id: number;
  type: TowerType;
  level: number;
  spec: number;
  name: string;
  targeting: TargetMode;
  damage: number;
  damageType: 'physical' | 'magic';
  range: number;
  rate: number;
  sellValue: number;
  upgrades: UpgradeOption[];
}

export interface Result {
  levelId: string;
  status: GameStatus;
  stars: number;
  score: number;
  lives: number;
  newBest: boolean;
}

export interface AppState {
  screen: Screen;
  save: Save;
  levelId: string | null;
  hud: Hud | null;
  speed: 1 | 2 | 3;
  paused: boolean;
  placing: TowerType | null;
  selectedId: number | null;
  selected: SelectedTower | null;
  result: Result | null;
  banner: { id: number; text: string } | null;
  toast: { id: number; text: string } | null;
  online: Online;
  /** Server verification of the last finished game. */
  submit: { id: string; status: SubmitStatus } | null;
  /** Level shown on the leaderboard screen. */
  boardLevelId: string | null;
}

const save = loadSave();

export const app = createStore<AppState>({
  screen: 'loading',
  save,
  levelId: null,
  hud: null,
  speed: save.settings.speed,
  paused: false,
  placing: null,
  selectedId: null,
  selected: null,
  result: null,
  banner: null,
  toast: null,
  online: { status: 'connecting', name: null, guest: true, providers: [] },
  submit: null,
  boardLevelId: null,
});

let messageId = 0;

export function showToast(text: string): void {
  app.set({ toast: { id: ++messageId, text } });
}

export function showBanner(text: string): void {
  app.set({ banner: { id: ++messageId, text } });
}
