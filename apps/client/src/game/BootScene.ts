import Phaser from 'phaser';
import { getLevelMap, LEVELS } from '@indesia/sim';
import { app } from '../app/state';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.load.image('terrain', '/assets/terrain.png');
    this.load.atlas('sprites', '/assets/sprites.png', '/assets/sprites.json');
    for (const level of LEVELS) {
      this.load.tilemapTiledJSON(`map-${level.id}`, getLevelMap(level.id) as object);
    }
  }

  create(): void {
    // Phaser text renders to a canvas once, so the pixel font must be ready first.
    const fonts = Promise.all([
      document.fonts.load('10px "Pixelify Sans"'),
      document.fonts.load('bold 10px "Pixelify Sans"'),
    ]).catch(() => undefined);
    void fonts.then(() => {
      this.scene.start('menu');
      app.set({ screen: 'title' });
    });
  }
}
