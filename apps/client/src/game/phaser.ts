import Phaser from 'phaser';
import { BattleScene } from './BattleScene';
import { BootScene } from './BootScene';
import { VIEW_HEIGHT, VIEW_WIDTH } from './constants';
import { MenuScene } from './MenuScene';

/**
 * Largest zoom that fits the window, as a whole number of *device* pixels per game pixel
 * so pixel art stays crisp on high-DPI screens. Screens smaller than the playfield fall
 * back to a fractional zoom.
 */
function fitZoom(): number {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT);
  const devicePixels = Math.floor(fit * dpr);
  return devicePixels >= 1 ? devicePixels / dpr : fit;
}

/** Publishes the canvas position so the HTML UI can sit exactly over the playfield. */
function syncStage(game: Phaser.Game, ui: HTMLElement): void {
  const r = game.canvas.getBoundingClientRect();
  ui.style.setProperty('--stage-x', `${r.left}px`);
  ui.style.setProperty('--stage-y', `${r.top}px`);
  ui.style.setProperty('--stage-w', `${r.width}px`);
  ui.style.setProperty('--stage-h', `${r.height}px`);
  ui.style.setProperty('--z', String(r.width / VIEW_WIDTH));
}

export function createPhaser(parent: HTMLElement, ui: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEW_WIDTH,
    height: VIEW_HEIGHT,
    backgroundColor: '#14121c',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: fitZoom(),
    },
    scene: [BootScene, MenuScene, BattleScene],
  });

  const fit = () => {
    game.scale.setZoom(fitZoom());
    requestAnimationFrame(() => syncStage(game, ui));
  };
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', fit);
  game.events.once(Phaser.Core.Events.READY, fit);
  return game;
}
