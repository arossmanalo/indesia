import Phaser from 'phaser';
import {
  type Enemy,
  enemyStats,
  type GameEvent,
  getLevel,
  isBuildable,
  statIndex,
  type Tower,
  towerStats,
  UNITS_PER_PX,
} from '@indesia/sim';
import { build, finishGame, selectTower, session } from '../app/actions';
import { syncHud } from '../app/hud';
import { app, showBanner, showToast } from '../app/state';
import { audio, type Sfx } from '../audio/audio';
import { GameController } from './controller';
import { TILE } from './constants';

const px = (units: number) => units / UNITS_PER_PX;

const FIRE_SOUNDS: Record<Tower['type'], Sfx> = {
  archer: 'arrow',
  cannon: 'cannon',
  mage: 'bolt',
  frost: 'shard',
};

const PROJECTILE_FRAMES: Record<Tower['type'], string> = {
  archer: 'proj-arrow',
  cannon: 'proj-ball',
  mage: 'proj-bolt',
  frost: 'proj-shard',
};

function towerFrame(t: Tower): string {
  const variant = t.level === 1 ? '1' : t.level === 2 ? '2' : t.spec === 1 ? 'b' : 'a';
  return `tower-${t.type}-${variant}`;
}

interface Tile {
  tx: number;
  ty: number;
}

export class BattleScene extends Phaser.Scene {
  private controller!: GameController;
  private towers = new Map<number, Phaser.GameObjects.Image>();
  private enemies = new Map<number, Phaser.GameObjects.Image>();
  private projectiles = new Map<number, Phaser.GameObjects.Image>();
  private prev = new Map<number, { x: number; y: number }>();
  private below!: Phaser.GameObjects.Graphics;
  private above!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private ghostTile: Tile | null = null;
  private alpha = 1;
  private ended = false;

  constructor() {
    super('battle');
  }

  create(data: { levelId: string; seed: number }): void {
    const level = getLevel(data.levelId);
    if (!level) throw new Error(`Unknown level ${data.levelId}`);

    // Scene instances are reused across restarts: reset all per-game state.
    this.towers = new Map();
    this.enemies = new Map();
    this.projectiles = new Map();
    this.prev = new Map();
    this.ghostTile = null;
    this.alpha = 1;
    this.ended = false;

    const map = this.make.tilemap({ key: `map-${level.id}` });
    const tiles = map.addTilesetImage('terrain', 'terrain');
    if (tiles) map.createLayer('ground', tiles, 0, 0)?.setDepth(-100);

    this.below = this.add.graphics().setDepth(-50);
    this.above = this.add.graphics().setDepth(10_000);
    this.ghost = this.add.image(0, 0, 'sprites', 'tower-archer-1').setAlpha(0.7).setVisible(false);
    this.ghost.setDepth(9_000);

    this.controller = new GameController(level, data.seed, app.get().speed);
    session.controller = this.controller;

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));

    const unsubscribe = app.subscribe(() => {
      if (!app.get().placing) this.ghostTile = null;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      if (session.controller === this.controller) session.controller = null;
    });

    this.cameras.main.fadeIn(300, 20, 18, 28);
    syncHud(this.controller);
  }

  override update(time: number, delta: number): void {
    const c = this.controller;
    const ui = app.get();
    c.speed = ui.speed;
    c.paused = ui.paused || ui.result !== null;

    this.alpha = c.advance(
      delta,
      () => this.snapshot(),
      (events) => this.handleEvents(events),
    );
    this.draw(time);
    syncHud(c);

    if (c.state.status !== 'playing' && !this.ended) {
      this.ended = true;
      this.time.delayedCall(600, () => finishGame(c));
    }
  }

  // --- input ---------------------------------------------------------------------------

  private tileAt(p: Phaser.Input.Pointer): Tile {
    return { tx: Math.floor(p.worldX / TILE), ty: Math.floor(p.worldY / TILE) };
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (!app.get().placing) return;
    // Mouse: the ghost follows the cursor. Touch: only while dragging.
    if (!p.wasTouch || p.isDown) this.ghostTile = this.tileAt(p);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    const ui = app.get();
    if (ui.result || ui.screen !== 'battle') return;
    const tile = this.tileAt(p);

    if (p.rightButtonDown()) {
      app.set({ placing: null, selectedId: null, selected: null });
      return;
    }

    if (ui.placing) {
      if (p.wasTouch) {
        // First tap previews the tower; a second tap on the same tile confirms.
        const same = this.ghostTile?.tx === tile.tx && this.ghostTile.ty === tile.ty;
        if (!same) {
          this.ghostTile = tile;
          return;
        }
      }
      if (build(ui.placing, tile.tx, tile.ty)) {
        const keep = !p.wasTouch && (p.event as MouseEvent).shiftKey;
        if (!keep) app.set({ placing: null });
      }
      return;
    }

    const tower = this.controller.state.towers.find((t) => t.tx === tile.tx && t.ty === tile.ty);
    selectTower(tower?.id ?? null);
  }

  // --- simulation events ---------------------------------------------------------------

  private snapshot(): void {
    const { state } = this.controller;
    for (const e of state.enemies) this.prev.set(e.id, { x: e.x, y: e.y });
    for (const p of state.projectiles) this.prev.set(p.id, { x: p.x, y: p.y });
  }

  private handleEvents(events: readonly GameEvent[]): void {
    const reducedShake = app.get().save.settings.reducedShake;
    for (const e of events) {
      switch (e.type) {
        case 'fire':
          audio.play(FIRE_SOUNDS[e.towerType]);
          break;
        case 'hit':
          if (e.splash === 0) audio.play('hit');
          this.spark(px(e.x), px(e.y));
          if (e.splash > 0) this.splash(px(e.x), px(e.y), px(e.splash), e.towerType);
          break;
        case 'kill':
          audio.play('kill');
          this.floatText(px(e.x), px(e.y) - 10, `+${e.bounty}`, '#f2c14e');
          break;
        case 'leak':
          audio.play('leak');
          if (!reducedShake) this.cameras.main.shake(140, 0.004);
          this.cameras.main.flash(120, 140, 30, 30);
          break;
        case 'build':
        case 'upgrade': {
          audio.play(e.type);
          const t = this.controller.state.towers.find((tw) => tw.id === e.towerId);
          if (t) this.dust(px(t.x), px(t.y) + 10);
          break;
        }
        case 'sell':
          audio.play('sell');
          this.dust((e.tx + 0.5) * TILE, (e.ty + 0.5) * TILE + 10);
          this.floatText((e.tx + 0.5) * TILE, e.ty * TILE, `+${e.refund}`, '#f2c14e');
          break;
        case 'waveStart':
          audio.play('wave');
          showBanner(
            e.early
              ? `Wave ${e.wave + 1} · +${e.bonus} gold`
              : `Wave ${e.wave + 1} of ${this.controller.level.waves.length}`,
          );
          break;
        case 'waveClear':
          audio.play('waveClear');
          showToast(`Wave ${e.wave + 1} cleared · +${e.bonus} gold`);
          break;
        default:
          break;
      }
    }
  }

  // --- effects -------------------------------------------------------------------------

  private spark(x: number, y: number): void {
    const s = this.add.image(x, y, 'sprites', 'icon-spark').setDepth(9_500).setScale(0.75);
    this.tweens.add({
      targets: s,
      alpha: 0,
      scale: 1.25,
      duration: 180,
      onComplete: () => s.destroy(),
    });
  }

  private splash(x: number, y: number, radius: number, towerType: string): void {
    const color = towerType === 'frost' ? 0x7fd1e8 : towerType === 'mage' ? 0x9a6ad1 : 0xe8913a;
    const ring = this.add.circle(x, y, radius, color, 0.25).setStrokeStyle(2, color, 0.9);
    ring.setDepth(9_400).setScale(0.3);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private dust(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const dx = (i - 2.5) * 4;
      const d = this.add.rectangle(x + dx, y, 3, 3, 0xe6c48a).setDepth(9_400);
      this.tweens.add({
        targets: d,
        x: x + dx * 2,
        y: y - 6 - (i % 3) * 3,
        alpha: 0,
        duration: 320,
        onComplete: () => d.destroy(),
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: '"Pixelify Sans", monospace',
        fontSize: '10px',
        color,
        stroke: '#1a1423',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9_800);
    this.tweens.add({
      targets: t,
      y: y - 14,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // --- drawing -------------------------------------------------------------------------

  private lerp(id: number, x: number, y: number): { x: number; y: number } {
    const p = this.prev.get(id);
    if (!p) return { x: px(x), y: px(y) };
    return { x: px(p.x + (x - p.x) * this.alpha), y: px(p.y + (y - p.y) * this.alpha) };
  }

  private sync<T extends { id: number }>(
    items: readonly T[],
    sprites: Map<number, Phaser.GameObjects.Image>,
    create: (item: T) => Phaser.GameObjects.Image,
    update: (item: T, sprite: Phaser.GameObjects.Image) => void,
  ): void {
    const alive = new Set<number>();
    for (const item of items) {
      alive.add(item.id);
      let sprite = sprites.get(item.id);
      if (!sprite) {
        sprite = create(item);
        sprites.set(item.id, sprite);
      }
      update(item, sprite);
    }
    for (const [id, sprite] of sprites) {
      if (!alive.has(id)) {
        sprite.destroy();
        sprites.delete(id);
        this.prev.delete(id);
      }
    }
  }

  private draw(time: number): void {
    const { state } = this.controller;
    const ui = app.get();
    this.below.clear();
    this.above.clear();

    this.sync(
      state.towers,
      this.towers,
      (t) => this.add.image(px(t.x), px(t.y) - 4, 'sprites', towerFrame(t)),
      (t, s) => {
        s.setFrame(towerFrame(t)).setDepth(px(t.y));
        this.drawPips(t);
      },
    );

    this.sync(
      state.enemies,
      this.enemies,
      (e) => this.add.image(0, 0, 'sprites', `enemy-${e.type}-0`),
      (e, s) => this.drawEnemy(e, s, time),
    );

    this.sync(
      state.projectiles,
      this.projectiles,
      (p) => this.add.image(px(p.x), px(p.y), 'sprites', PROJECTILE_FRAMES[p.towerType]),
      (p, s) => {
        const pos = this.lerp(p.id, p.x, p.y);
        if (p.towerType === 'archer') s.setRotation(Math.atan2(p.ty - p.y, p.tx - p.x));
        s.setPosition(pos.x, pos.y).setDepth(9_000);
      },
    );

    // Range of the selected tower.
    const selected = state.towers.find((t) => t.id === ui.selectedId);
    if (selected) {
      const stats = towerStats(selected.type)[statIndex(selected.level, selected.spec)];
      this.drawRange(px(selected.x), px(selected.y), px(stats.range), 0xf4efe6);
    }

    this.drawGhost(ui.placing);
  }

  private drawEnemy(e: Enemy, s: Phaser.GameObjects.Image, time: number): void {
    const stats = enemyStats(e.type);
    const pos = this.lerp(e.id, e.x, e.y);
    const prev = this.prev.get(e.id);
    const frame = Math.floor((time + e.id * 97) / (e.type === 'bat' ? 120 : 220)) % 2;
    const bob = stats.flying ? Math.sin((time + e.id * 131) / 160) * 2 - 8 : 0;
    s.setFrame(`enemy-${e.type}-${frame}`);
    s.setPosition(pos.x, pos.y - 6 + bob);
    s.setDepth(pos.y + (stats.flying ? 500 : 0));
    if (prev && e.x !== prev.x) s.setFlipX(e.x < prev.x);
    if (e.type === 'warlord') s.setScale(1.4);
    s.setTint(e.slowTicks > 0 ? 0x9fe0f0 : 0xffffff);

    // Shadow and health bar.
    this.below.fillStyle(0x1a1423, 0.35);
    this.below.fillEllipse(pos.x, pos.y + 8, stats.flying ? 10 : 16, 5);
    if (e.hp < e.maxHp) {
      const w = e.type === 'warlord' ? 24 : 16;
      const x = pos.x - w / 2;
      const y = pos.y - 24 + bob;
      this.above.fillStyle(0x1a1423, 1).fillRect(x - 1, y - 1, w + 2, 4);
      this.above.fillStyle(0xa8323a, 1).fillRect(x, y, w, 2);
      this.above.fillStyle(0x8cc152, 1).fillRect(x, y, Math.max(1, (w * e.hp) / e.maxHp), 2);
    }
  }

  private drawPips(t: Tower): void {
    const x = px(t.x);
    const y = px(t.y) + 12;
    for (let i = 0; i < t.level; i++) {
      const pxl = x - (t.level - 1) * 2.5 + i * 5;
      this.above.fillStyle(0x1a1423, 1).fillRect(pxl - 2, y - 1, 4, 4);
      this.above.fillStyle(t.level === 3 ? 0xf2c14e : 0xc8c8d8, 1).fillRect(pxl - 1, y, 2, 2);
    }
  }

  private drawRange(x: number, y: number, radius: number, color: number): void {
    this.below.fillStyle(color, 0.12).fillCircle(x, y, radius);
    this.below.lineStyle(1, color, 0.6).strokeCircle(x, y, radius);
  }

  private drawGhost(placing: string | null): void {
    const tile = this.ghostTile;
    if (!placing || !tile) {
      this.ghost.setVisible(false);
      return;
    }
    const { state, level } = this.controller;
    const stats = towerStats(placing as Tower['type'])[0];
    const free =
      isBuildable(level, tile.tx, tile.ty) &&
      !state.towers.some((t) => t.tx === tile.tx && t.ty === tile.ty);
    const ok = free && state.gold >= stats.cost;
    const x = (tile.tx + 0.5) * TILE;
    const y = (tile.ty + 0.5) * TILE;
    this.ghost
      .setFrame(`tower-${placing}-1`)
      .setPosition(x, y - 4)
      .setVisible(true)
      .setTint(ok ? 0xffffff : 0xff7a7a);
    this.drawRange(x, y, px(stats.range), ok ? 0x8cc152 : 0xe2574c);
    this.below
      .lineStyle(1, ok ? 0x8cc152 : 0xe2574c, 1)
      .strokeRect(tile.tx * TILE, tile.ty * TILE, TILE, TILE);
  }
}
