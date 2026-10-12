import Phaser from 'phaser';
import { TILE, VIEW_HEIGHT, VIEW_WIDTH } from './constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x231f30, 1);
    for (let x = 0; x <= VIEW_WIDTH; x += TILE) grid.lineBetween(x, 0, x, VIEW_HEIGHT);
    for (let y = 0; y <= VIEW_HEIGHT; y += TILE) grid.lineBetween(0, y, VIEW_WIDTH, y);

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 16, 'INDESIA', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#f2c14e',
      })
      .setOrigin(0.5);

    this.add
      .text(VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 28, 'The last road must hold.', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#8a7f9e',
      })
      .setOrigin(0.5);
  }
}
