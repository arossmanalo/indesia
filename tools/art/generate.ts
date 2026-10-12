/**
 * Generates the game's pixel art from the sources in sprites.ts:
 *   apps/client/public/assets/terrain.png   Tiled tileset (see terrain.ts for the layout)
 *   apps/client/public/assets/sprites.png   sprite atlas
 *   apps/client/public/assets/sprites.json  atlas frames (Phaser JSON hash format)
 *   apps/client/src/ui/icons.css            CSS sprites for the HTML UI
 * Usage: pnpm art
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { color } from './palette';
import { encodePng, Image } from './png';
import { DECOR, ENEMIES, ICONS, PROJECTILES, TOWER_VARIANTS, TOWERS } from './sprites';
import { PATH_E, PATH_N, PATH_S, PATH_W, T, TERRAIN_COLUMNS, TERRAIN_ROWS } from './terrain';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const assets = join(root, 'apps', 'client', 'public', 'assets');
const SCALE = 2;
const ART = 16; // art pixels per tile
const TILE = ART * SCALE;

function fromGrid(rows: readonly string[], swap: Record<string, string> = {}): Image {
  const size = rows.length;
  const img = new Image(rows[0]!.length, size);
  rows.forEach((row, y) => {
    if (row.length !== img.width)
      throw new Error(`Row ${y} has width ${row.length}, expected ${img.width}: ${row}`);
    [...row].forEach((ch, x) => img.set(x, y, color(swap[ch] ?? ch)));
  });
  return img;
}

/** Deterministic per-pixel noise in [0, 1000). */
function noise(x: number, y: number, seed: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2147483647, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
}

function grass(seed: number): Image {
  const img = new Image(ART, ART);
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      const n = noise(x, y, seed);
      img.set(x, y, color(n < 90 ? 'g' : n > 930 ? 'L' : 'G'));
    }
  }
  return img;
}

function overlay(base: Image, top: Image): Image {
  base.blit(top, 0, 0);
  return base;
}

function flowers(): Image {
  const img = grass(11);
  const spots: [number, number, string][] = [
    [3, 4, 'Y'],
    [11, 3, 'w'],
    [6, 10, 'R'],
    [13, 12, 'Y'],
    [2, 13, 'w'],
  ];
  for (const [x, y, c] of spots) {
    img.set(x, y, color(c));
    img.set(x - 1, y, color('y'));
    img.set(x + 1, y, color('y'));
    img.set(x, y - 1, color('y'));
    img.set(x, y + 1, color('g'));
  }
  return img;
}

function tallGrass(): Image {
  const img = grass(12);
  for (let i = 0; i < 9; i++) {
    const x = 1 + ((i * 5) % 14);
    const y = 3 + ((i * 7) % 11);
    img.set(x, y, color('L'));
    img.set(x, y + 1, color('L'));
    img.set(x, y + 2, color('g'));
    img.set(x + 1, y + 1, color('y'));
  }
  return img;
}

/** Dirt road tile; `mask` says which sides connect to neighbouring road tiles. */
function path(mask: number): Image {
  const img = grass(20 + mask);
  const lo = 3;
  const hi = 12;
  const inside = (x: number, y: number) => {
    const inCore = x >= lo && x <= hi && y >= lo && y <= hi;
    const n = mask & PATH_N && x >= lo && x <= hi && y < lo;
    const s = mask & PATH_S && x >= lo && x <= hi && y > hi;
    const e = mask & PATH_E && y >= lo && y <= hi && x > hi;
    const w = mask & PATH_W && y >= lo && y <= hi && x < lo;
    return inCore || n || s || e || w;
  };
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      if (!inside(x, y)) continue;
      const n = noise(x, y, 99);
      img.set(x, y, color(n < 120 ? 'D' : n > 900 ? 'T' : 't'));
    }
  }
  // Darker rim where the road meets grass; round off outer corners.
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      if (!inside(x, y)) continue;
      const edge = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].some(([dx, dy]) => {
        const nx = x + dx!;
        const ny = y + dy!;
        return nx >= 0 && ny >= 0 && nx < ART && ny < ART && !inside(nx, ny);
      });
      if (edge) img.set(x, y, color('D'));
    }
  }
  return img;
}

function water(): Image {
  const img = new Image(ART, ART);
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      const n = noise(x, y, 7);
      img.set(x, y, color(n < 150 ? 'b' : 'B'));
    }
  }
  for (const [x, y] of [
    [2, 3],
    [9, 6],
    [4, 11],
    [12, 13],
  ] as const) {
    for (let i = 0; i < 3; i++) img.set(x + i, y, color('c'));
  }
  return img;
}

function buildMarker(): Image {
  const img = new Image(ART, ART);
  for (let y = 0; y < ART; y++) {
    for (let x = 0; x < ART; x++) {
      const border = x === 0 || y === 0 || x === ART - 1 || y === ART - 1;
      img.set(x, y, border ? [255, 255, 255, 200] : [255, 255, 255, 60]);
    }
  }
  return img;
}

function terrain(): Image {
  const sheet = new Image(TERRAIN_COLUMNS * TILE, TERRAIN_ROWS * TILE);
  const put = (index: number, img: Image) =>
    sheet.blit(
      img,
      (index % TERRAIN_COLUMNS) * TILE,
      Math.floor(index / TERRAIN_COLUMNS) * TILE,
      SCALE,
    );
  T.grass.forEach((index, i) => put(index, grass(i + 1)));
  put(T.flowers, flowers());
  put(T.tallGrass, tallGrass());
  for (let mask = 0; mask < 16; mask++) put(T.pathBase + mask, path(mask));
  put(T.rock, overlay(grass(30), fromGrid(DECOR.rock)));
  put(T.tree, overlay(grass(31), fromGrid(DECOR.tree)));
  put(T.water, water());
  put(T.bush, overlay(grass(32), fromGrid(DECOR.bush)));
  put(T.buildMarker, buildMarker());
  return sheet;
}

/** Moves the bottom rows one pixel sideways: a cheap second walking frame. */
function stride(img: Image): Image {
  const out = new Image(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const sx = y >= 12 ? x - 1 : x;
      if (sx >= 0) out.set(x, y, img.get(sx, y));
    }
  }
  return out;
}

/** Bat wings flap: shift wing tips up a pixel. */
function flap(img: Image): Image {
  const out = new Image(img.width, img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const wing = x < 5 || x > 10;
      const sy = wing ? y + 1 : y;
      if (sy < img.height) out.set(x, y, img.get(x, sy));
    }
  }
  return out;
}

interface Frame {
  name: string;
  img: Image;
}

function spriteFrames(): Frame[] {
  const frames: Frame[] = [];
  for (const [type, rows] of Object.entries(TOWERS)) {
    frames.push({ name: `tower-${type}-1`, img: fromGrid(rows) });
    for (const variant of ['2', 'a', 'b'] as const) {
      frames.push({
        name: `tower-${type}-${variant}`,
        img: fromGrid(rows, TOWER_VARIANTS[type as keyof typeof TOWERS][variant]),
      });
    }
  }
  for (const [type, rows] of Object.entries(ENEMIES)) {
    const base = fromGrid(rows);
    frames.push({ name: `enemy-${type}-0`, img: base });
    frames.push({
      name: `enemy-${type}-1`,
      img: type === 'bat' ? flap(base) : type === 'wraith' ? base : stride(base),
    });
  }
  for (const [name, rows] of Object.entries(PROJECTILES))
    frames.push({ name: `proj-${name}`, img: fromGrid(rows) });
  for (const [name, rows] of Object.entries(ICONS))
    frames.push({ name: `icon-${name}`, img: fromGrid(rows) });
  return frames;
}

function atlas(frames: Frame[]) {
  const columns = 8;
  const rows = Math.ceil(frames.length / columns);
  const sheet = new Image(columns * TILE, rows * TILE);
  const json: { frames: Record<string, unknown>; meta: Record<string, unknown> } = {
    frames: {},
    meta: {
      app: 'indesia tools/art',
      image: 'sprites.png',
      format: 'RGBA8888',
      size: { w: sheet.width, h: sheet.height },
      scale: '1',
    },
  };
  const css: string[] = [];
  frames.forEach((f, i) => {
    const x = (i % columns) * TILE;
    const y = Math.floor(i / columns) * TILE;
    sheet.blit(f.img, x, y, SCALE);
    const w = f.img.width * SCALE;
    const h = f.img.height * SCALE;
    json.frames[f.name] = {
      frame: { x, y, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    };
    if (f.name.startsWith('icon-') || f.name.startsWith('tower-') || f.name.startsWith('enemy-')) {
      css.push(
        `.px-${f.name} { --w: ${w}; --h: ${h}; background-position: calc(${-x}px * var(--px-scale, 1)) calc(${-y}px * var(--px-scale, 1)); }`,
      );
    }
  });
  const cssFile = [
    '/* Generated by tools/art/generate.ts. Do not edit. */',
    '.px {',
    '  display: inline-block;',
    '  flex: none;',
    '  width: calc(var(--w) * 1px * var(--px-scale, 1));',
    '  height: calc(var(--h) * 1px * var(--px-scale, 1));',
    "  background-image: url('/assets/sprites.png');",
    `  background-size: calc(${sheet.width}px * var(--px-scale, 1)) calc(${sheet.height}px * var(--px-scale, 1));`,
    '  image-rendering: pixelated;',
    '}',
    ...css,
    '',
  ].join('\n');
  return { sheet, json, cssFile };
}

mkdirSync(assets, { recursive: true });
writeFileSync(join(assets, 'terrain.png'), encodePng(terrain()));
const { sheet, json, cssFile } = atlas(spriteFrames());
writeFileSync(join(assets, 'sprites.png'), encodePng(sheet));
writeFileSync(join(assets, 'sprites.json'), JSON.stringify(json, null, 2) + '\n');
writeFileSync(join(root, 'apps', 'client', 'src', 'ui', 'icons.css'), cssFile);
console.log(
  `Wrote terrain.png, sprites.png (${Object.keys(json.frames).length} frames), icons.css`,
);
