/**
 * Turns an ASCII map draft into a Tiled map (JSON) that the game and the Tiled editor can
 * open. Usage: tsx tools/maps/ascii-to-tiled.ts <draft.txt> <out/map.json>
 *
 * Legend:
 *   .  grass (buildable)     ,  flowers (buildable)    "  tall grass (buildable)
 *   #  path                  S  path start on an edge  E  path exit on an edge
 *   T  tree (blocked)        R  rock (blocked)         ~  water (blocked)   b  bush (blocked)
 *
 * Multiple entrances: use S, then 1..9 for extra starts; every start must reach an E.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATH_E, PATH_N, PATH_S, PATH_W, T, TERRAIN_COLUMNS, TERRAIN_ROWS } from '../art/terrain';

const TILE = 32;
const PATH_CHARS = new Set(['#', 'S', 'E', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
const BUILDABLE_CHARS = new Set(['.', ',', '"']);
const START_CHARS = ['S', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

type Cell = { x: number; y: number };

export interface AsciiMap {
  width: number;
  height: number;
  rows: string[];
}

export function parseAscii(text: string): AsciiMap {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trimEnd())
    .filter((r) => r.length > 0 && !r.startsWith(';'));
  const width = rows[0]?.length ?? 0;
  if (rows.some((r) => r.length !== width)) throw new Error('All rows must have the same width');
  return { width, height: rows.length, rows };
}

function charAt(m: AsciiMap, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height) return ' ';
  return m.rows[y]![x]!;
}

function isPath(m: AsciiMap, x: number, y: number): boolean {
  return PATH_CHARS.has(charAt(m, x, y));
}

/** Small deterministic hash for picking decorative variants. */
function noise(x: number, y: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h ^= h >>> 13;
  return (h >>> 0) % 1000;
}

function outward(m: AsciiMap, c: Cell): Cell {
  if (c.x === 0) return { x: -1, y: c.y };
  if (c.x === m.width - 1) return { x: m.width, y: c.y };
  if (c.y === 0) return { x: c.x, y: -1 };
  if (c.y === m.height - 1) return { x: c.x, y: m.height };
  throw new Error(`Path endpoint (${c.x},${c.y}) must be on the map edge`);
}

function tracePath(m: AsciiMap, start: Cell): Cell[] {
  const cells: Cell[] = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  let cur = start;
  while (charAt(m, cur.x, cur.y) !== 'E') {
    const next = [
      { x: cur.x, y: cur.y - 1 },
      { x: cur.x + 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x - 1, y: cur.y },
    ].filter((n) => isPath(m, n.x, n.y) && !seen.has(`${n.x},${n.y}`));
    // At junctions where paths merge, prefer continuing straight.
    const dx = cells.length > 1 ? cur.x - cells[cells.length - 2]!.x : 0;
    const dy = cells.length > 1 ? cur.y - cells[cells.length - 2]!.y : 0;
    const pick = next.find((n) => n.x - cur.x === dx && n.y - cur.y === dy) ?? next[0];
    if (!pick)
      throw new Error(`Path from (${start.x},${start.y}) dead-ends at (${cur.x},${cur.y})`);
    seen.add(`${pick.x},${pick.y}`);
    cells.push(pick);
    cur = pick;
  }
  return cells;
}

/** Polyline through cell centers (pixels), collinear points removed, extended off-map. */
function toPolyline(m: AsciiMap, cells: Cell[]): { x: number; y: number }[] {
  const full = [outward(m, cells[0]!), ...cells, outward(m, cells[cells.length - 1]!)];
  const pts = full.map((c) => ({ x: c.x * TILE + TILE / 2, y: c.y * TILE + TILE / 2 }));
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1]!;
    const b = pts[i + 1]!;
    return (p.x - a.x) * (b.y - p.y) !== (p.y - a.y) * (b.x - p.x);
  });
}

function groundTile(m: AsciiMap, x: number, y: number): number {
  const c = charAt(m, x, y);
  if (PATH_CHARS.has(c)) {
    let mask = 0;
    // Edge cells connect outward so the road runs off the map.
    const edge = (nx: number, ny: number) =>
      isPath(m, nx, ny) ||
      ((nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) &&
        (c === 'E' || START_CHARS.includes(c)));
    if (edge(x, y - 1)) mask |= PATH_N;
    if (edge(x + 1, y)) mask |= PATH_E;
    if (edge(x, y + 1)) mask |= PATH_S;
    if (edge(x - 1, y)) mask |= PATH_W;
    return T.pathBase + mask;
  }
  switch (c) {
    case ',':
      return T.flowers;
    case '"':
      return T.tallGrass;
    case 'T':
      return T.tree;
    case 'R':
      return T.rock;
    case '~':
      return T.water;
    case 'b':
      return T.bush;
    default:
      return T.grass[noise(x, y) % T.grass.length]!;
  }
}

export function asciiToTiled(m: AsciiMap, tilesetImage: string): object {
  const ground: number[] = [];
  const buildable: number[] = [];
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      ground.push(groundTile(m, x, y) + 1);
      buildable.push(BUILDABLE_CHARS.has(charAt(m, x, y)) ? T.buildMarker + 1 : 0);
    }
  }

  const starts: Cell[] = [];
  for (const s of START_CHARS) {
    for (let y = 0; y < m.height; y++) {
      const x = m.rows[y]!.indexOf(s);
      if (x >= 0) starts.push({ x, y });
    }
  }
  if (starts.length === 0) throw new Error('Map needs a start (S)');

  const objects = starts.map((s, i) => {
    const polyline = toPolyline(m, tracePath(m, s));
    const origin = polyline[0]!;
    return {
      id: i + 1,
      name: `path-${i}`,
      type: '',
      x: origin.x,
      y: origin.y,
      width: 0,
      height: 0,
      rotation: 0,
      visible: true,
      polyline: polyline.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y })),
    };
  });

  const tileLayer = (id: number, name: string, data: number[], visible: boolean) => ({
    id,
    name,
    type: 'tilelayer',
    width: m.width,
    height: m.height,
    x: 0,
    y: 0,
    opacity: 1,
    visible,
    data,
  });

  return {
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.0',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    width: m.width,
    height: m.height,
    tilewidth: TILE,
    tileheight: TILE,
    infinite: false,
    nextlayerid: 4,
    nextobjectid: objects.length + 1,
    layers: [
      tileLayer(1, 'ground', ground, true),
      tileLayer(2, 'buildable', buildable, false),
      {
        id: 3,
        name: 'path',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects,
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        name: 'terrain',
        image: tilesetImage,
        imagewidth: TERRAIN_COLUMNS * TILE,
        imageheight: TERRAIN_ROWS * TILE,
        tilewidth: TILE,
        tileheight: TILE,
        columns: TERRAIN_COLUMNS,
        tilecount: TERRAIN_COLUMNS * TERRAIN_ROWS,
        margin: 0,
        spacing: 0,
      },
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: tsx tools/maps/ascii-to-tiled.ts <draft.txt> <out/map.json>');
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const image = relative(
    dirname(resolve(output)),
    resolve(root, 'apps/client/public/assets/terrain.png'),
  ).replaceAll('\\', '/');
  const map = asciiToTiled(parseAscii(readFileSync(input, 'utf8')), image);
  writeFileSync(output, JSON.stringify(map, null, 1) + '\n');
  console.log(`Wrote ${output}`);
}
