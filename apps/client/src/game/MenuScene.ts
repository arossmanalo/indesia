import Phaser from 'phaser';
import { LEVELS } from '@indesia/sim';
import { VIEW_HEIGHT, VIEW_WIDTH } from './constants';

/** Backdrop behind the title and level select: the first map under a dark veil. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const map = this.make.tilemap({ key: `map-${LEVELS[0]!.id}` });
    const tiles = map.addTilesetImage('terrain', 'terrain');
    if (tiles) map.createLayer('ground', tiles, 0, 0);
    this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x14121c, 0.55).setOrigin(0);
    this.cameras.main.fadeIn(400, 20, 18, 28);
  }
}
