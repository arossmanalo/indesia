import Phaser from 'phaser';
import { type EnemyType, enemyStats, LEVELS, TICK_RATE, UNITS_PER_PX } from '@indesia/sim';
import { VIEW_HEIGHT, VIEW_WIDTH } from './constants';

const MARCHERS: EnemyType[] = ['grunt', 'grunt', 'runner', 'knight', 'bat', 'grunt', 'shaman'];

/** Backdrop behind the title and level select: the first map with the horde marching by. */
export class MenuScene extends Phaser.Scene {
  private spawned = 0;

  constructor() {
    super('menu');
  }

  create(): void {
    const level = LEVELS[0]!;
    const map = this.make.tilemap({ key: `map-${level.id}` });
    const tiles = map.addTilesetImage('terrain', 'terrain');
    if (tiles) map.createLayer('ground', tiles, 0, 0);
    this.add.rectangle(0, 0, VIEW_WIDTH, VIEW_HEIGHT, 0x14121c, 0.55).setOrigin(0).setDepth(1000);
    this.cameras.main.fadeIn(400, 20, 18, 28);

    const points = level.paths[0]!.segments.flatMap((s, i) =>
      i === 0
        ? [
            { x: s.ax, y: s.ay },
            { x: s.bx, y: s.by },
          ]
        : [{ x: s.bx, y: s.by }],
    );
    this.spawned = 0;
    this.time.addEvent({
      delay: 1600,
      loop: true,
      startAt: 1500,
      callback: () => this.march(points, MARCHERS[this.spawned++ % MARCHERS.length]!),
    });
  }

  private march(points: { x: number; y: number }[], type: EnemyType): void {
    const stats = enemyStats(type);
    const pxPerMs = (stats.speed * TICK_RATE) / UNITS_PER_PX / 1000;
    const first = points[0]!;
    const sprite = this.add.image(
      first.x / UNITS_PER_PX,
      first.y / UNITS_PER_PX - 6,
      'sprites',
      `enemy-${type}-0`,
    );
    sprite.setDepth(stats.flying ? 600 : 500);
    const walk = this.time.addEvent({
      delay: stats.flying ? 120 : 220,
      loop: true,
      callback: () => sprite.setFrame(`enemy-${type}-${sprite.frame.name.endsWith('0') ? 1 : 0}`),
    });
    const legs = points.slice(1).map((p, i) => {
      const from = points[i]!;
      const dist = Math.hypot(p.x - from.x, p.y - from.y) / UNITS_PER_PX;
      return {
        x: p.x / UNITS_PER_PX,
        y: p.y / UNITS_PER_PX - 6 - (stats.flying ? 8 : 0),
        duration: dist / pxPerMs,
        onStart: () => sprite.setFlipX(p.x < from.x),
      };
    });
    this.tweens.chain({
      targets: sprite,
      tweens: legs,
      onComplete: () => {
        walk.remove();
        sprite.destroy();
      },
    });
  }
}
