import type Phaser from 'phaser';
import {
  type Command,
  hasTower,
  LEVELS,
  outcomeOf,
  TARGET_MODES,
  type TargetMode,
  TOWER_TYPES,
  type TowerType,
} from '@indesia/sim';
import { audio } from '../audio/audio';
import { type GameController, randomSeed, type Speed } from '../game/controller';
import { queueScore, sendTelemetry, syncSave } from './online';
import { recordOutcome, writeSave } from './save';
import { app, showToast } from './state';

/** Live objects the UI talks to. */
export const session: { phaser: Phaser.Game | null; controller: GameController | null } = {
  phaser: null,
  controller: null,
};

export function showTitle(): void {
  app.set({ screen: 'title' });
}

function reportGame(controller: GameController, status: 'won' | 'lost' | 'quit'): void {
  const { state } = controller;
  sendTelemetry({
    kind: 'game_end',
    levelId: controller.level.id,
    status,
    wave: state.wavesStarted,
    ticks: state.tick,
    livesLostPerWave: state.stats.livesLostPerWave,
    towersBuilt: state.stats.towersBuilt,
  });
}

export function showLeaderboard(levelId: string | null = app.get().levelId ?? LEVELS[0]!.id): void {
  showLevels();
  app.set({ screen: 'leaderboard', boardLevelId: levelId });
}

export function showLevels(): void {
  const phaser = session.phaser;
  const { controller } = session;
  if (
    controller &&
    !app.get().result &&
    controller.state.status === 'playing' &&
    controller.state.tick > 0
  ) {
    reportGame(controller, 'quit');
  }
  if (phaser?.scene.isActive('battle')) {
    phaser.scene.stop('battle');
    phaser.scene.start('menu');
  }
  app.set({
    screen: 'levels',
    result: null,
    hud: null,
    placing: null,
    selectedId: null,
    selected: null,
  });
}

export function startLevel(levelId: string): void {
  const phaser = session.phaser;
  if (!phaser) return;
  app.set({
    screen: 'battle',
    levelId,
    hud: null,
    result: null,
    paused: false,
    placing: null,
    selectedId: null,
    selected: null,
    banner: null,
  });
  phaser.scene.stop('menu');
  if (phaser.scene.isActive('battle')) phaser.scene.stop('battle');
  phaser.scene.start('battle', { levelId, seed: randomSeed() });
}

export function retryLevel(): void {
  const { levelId } = app.get();
  if (levelId) startLevel(levelId);
}

export function nextLevelId(levelId: string | null): string | null {
  const index = LEVELS.findIndex((l) => l.id === levelId);
  return index >= 0 ? (LEVELS[index + 1]?.id ?? null) : null;
}

/** Called by the battle scene when the game ends. */
export function finishGame(controller: GameController): void {
  const outcome = outcomeOf(controller.game);
  const levelId = controller.level.id;
  const { save, newBest } = recordOutcome(app.get().save, levelId, outcome);
  writeSave(save);
  audio.play(outcome.status === 'won' ? 'victory' : 'defeat');
  reportGame(controller, outcome.status === 'won' ? 'won' : 'lost');
  // Victories go to the server for verification; the queue survives being offline.
  const submitId = outcome.status === 'won' ? queueScore(controller.replay()) : null;
  app.set({
    save,
    submit: submitId ? { id: submitId, status: { state: 'pending' } } : null,
    placing: null,
    selectedId: null,
    selected: null,
    result: {
      levelId,
      status: outcome.status,
      stars: outcome.stars,
      score: outcome.score,
      lives: outcome.lives,
      newBest,
    },
  });
  void syncSave();
}

function issue(cmd: Command): boolean {
  const c = session.controller;
  if (!c || app.get().result) return false;
  const result = c.issue(cmd);
  if (!result.ok) {
    audio.play('error');
    showToast(result.reason[0]!.toUpperCase() + result.reason.slice(1));
  }
  return result.ok;
}

export function build(tower: TowerType, tx: number, ty: number): boolean {
  return issue({ type: 'build', tower, tx, ty });
}

export function callWave(): void {
  issue({ type: 'callWave' });
}

export function upgradeSelected(branch?: 0 | 1): void {
  const { selectedId } = app.get();
  if (selectedId === null) return;
  issue(
    branch === undefined
      ? { type: 'upgrade', towerId: selectedId }
      : { type: 'upgrade', towerId: selectedId, branch },
  );
}

export function sellSelected(): void {
  const { selectedId } = app.get();
  if (selectedId !== null && issue({ type: 'sell', towerId: selectedId })) {
    app.set({ selectedId: null, selected: null });
  }
}

export function setTargeting(mode: TargetMode): void {
  const { selectedId } = app.get();
  if (selectedId !== null) issue({ type: 'target', towerId: selectedId, mode });
}

export function cycleTargeting(): void {
  const current = app.get().selected?.targeting;
  if (!current) return;
  setTargeting(TARGET_MODES[(TARGET_MODES.indexOf(current) + 1) % TARGET_MODES.length]!);
}

export function selectTower(id: number | null): void {
  app.set({ selectedId: id, placing: null });
  if (id === null) app.set({ selected: null });
}

export function beginPlacing(tower: TowerType): void {
  if (!hasTower(tower) || app.get().result) return;
  app.set({
    placing: app.get().placing === tower ? null : tower,
    selectedId: null,
    selected: null,
  });
}

export function placeableTowers(): TowerType[] {
  return TOWER_TYPES.filter(hasTower);
}

/** Esc / right click: back out of whatever is in progress. */
export function cancel(): void {
  const s = app.get();
  if (s.placing) app.set({ placing: null });
  else if (s.selectedId !== null) app.set({ selectedId: null, selected: null });
  else if (s.screen === 'battle' && !s.result) togglePause();
}

export function togglePause(): void {
  if (app.get().result) return;
  app.set({ paused: !app.get().paused });
}

export function setSpeed(speed: Speed): void {
  const save = app.get().save;
  const next = {
    ...save,
    settings: { ...save.settings, speed },
    settingsUpdatedAt: new Date().toISOString(),
  };
  writeSave(next);
  app.set({ speed, save: next });
}

export function cycleSpeed(): void {
  const s = app.get().speed;
  setSpeed(s === 3 ? 1 : ((s + 1) as Speed));
}
