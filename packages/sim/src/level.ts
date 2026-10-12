import { z } from 'zod';
import { EnemyType } from './content/schema';
import { hasEnemy } from './content/compiled';
import { Hasher } from './hash';
import { isqrt, secondsToTicks, TILE_PX, UNITS_PER_PX } from './math';

// ---------------------------------------------------------------------------
// Tiled map (only the parts the simulation needs)
// ---------------------------------------------------------------------------

const TiledTileLayer = z.object({
  type: z.literal('tilelayer'),
  name: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  data: z.array(z.number().int()),
});

const TiledObjectLayer = z.object({
  type: z.literal('objectgroup'),
  name: z.string(),
  objects: z.array(
    z.object({
      name: z.string(),
      x: z.number(),
      y: z.number(),
      polyline: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    }),
  ),
});

const TiledLayer = z.union([TiledTileLayer, TiledObjectLayer, z.object({ type: z.string() })]);

export const TiledMap = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  tilewidth: z.literal(TILE_PX),
  tileheight: z.literal(TILE_PX),
  layers: z.array(TiledLayer),
});
export type TiledMap = z.infer<typeof TiledMap>;

// ---------------------------------------------------------------------------
// Level definition (waves + economy), authored next to the map
// ---------------------------------------------------------------------------

export const WaveGroupDef = z.object({
  enemy: EnemyType,
  count: z.number().int().positive(),
  /** Seconds between spawns within the group. */
  interval: z.number().nonnegative(),
  /** Seconds after the wave starts before the group's first spawn. */
  delay: z.number().nonnegative().default(0),
  /** Index of the path to walk (maps may have several entrances). */
  path: z.number().int().nonnegative().default(0),
});

export const WaveDef = z.object({
  groups: z.array(WaveGroupDef).min(1),
  /** Enemy health for this wave as a percentage of their base health. */
  hpPct: z.number().int().min(10).max(2000).default(100),
  /** Gold awarded once every enemy of the wave is gone. */
  bonus: z.number().int().nonnegative(),
});

export const LevelDef = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  description: z.string(),
  startingGold: z.number().int().positive(),
  waves: z.array(WaveDef).min(1),
});
export type LevelDef = z.input<typeof LevelDef>;

// ---------------------------------------------------------------------------
// Compiled level used by the simulation
// ---------------------------------------------------------------------------

export interface PathSegment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Distance along the path at the segment start. */
  start: number;
  length: number;
}

export interface Path {
  segments: PathSegment[];
  length: number;
}

export interface CompiledGroup {
  enemy: EnemyType;
  count: number;
  intervalTicks: number;
  delayTicks: number;
  path: number;
}

export interface CompiledWave {
  groups: CompiledGroup[];
  hpPct: number;
  bonus: number;
  enemyCount: number;
}

export interface Level {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  /** Row-major; true where towers may be built. */
  buildable: boolean[];
  paths: Path[];
  startingGold: number;
  waves: CompiledWave[];
  /** Hash of the map + level content, recorded in replays. */
  hash: string;
}

function compilePath(points: { x: number; y: number }[]): Path {
  const segments: PathSegment[] = [];
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = isqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    if (length === 0) continue;
    segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, start, length });
    start += length;
  }
  if (segments.length === 0) throw new Error('Path needs at least two distinct points');
  return { segments, length: start };
}

/** Builds a level from its Tiled map and level definition, validating both. */
export function compileLevel(mapJson: unknown, levelJson: unknown): Level {
  const map = TiledMap.parse(mapJson);
  const def = LevelDef.parse(levelJson);

  const buildLayer = map.layers.find(
    (l): l is z.infer<typeof TiledTileLayer> =>
      l.type === 'tilelayer' && 'name' in l && l.name === 'buildable',
  );
  if (!buildLayer) throw new Error(`${def.id}: map has no "buildable" tile layer`);
  if (buildLayer.data.length !== map.width * map.height) {
    throw new Error(`${def.id}: "buildable" layer size does not match the map`);
  }

  const pathLayer = map.layers.find(
    (l): l is z.infer<typeof TiledObjectLayer> =>
      l.type === 'objectgroup' && 'name' in l && l.name === 'path',
  );
  const polylines = (pathLayer?.objects ?? [])
    .filter((o) => o.polyline !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (polylines.length === 0) throw new Error(`${def.id}: map has no polyline in the "path" layer`);

  const paths = polylines.map((o) =>
    compilePath(
      o.polyline!.map((p) => ({
        x: Math.round((o.x + p.x) * UNITS_PER_PX),
        y: Math.round((o.y + p.y) * UNITS_PER_PX),
      })),
    ),
  );

  const waves = def.waves.map((wave, w) => {
    const groups = wave.groups.map((g) => {
      if (!hasEnemy(g.enemy))
        throw new Error(`${def.id}: wave ${w + 1} uses unknown enemy ${g.enemy}`);
      if (g.path >= paths.length)
        throw new Error(`${def.id}: wave ${w + 1} uses missing path ${g.path}`);
      return {
        enemy: g.enemy,
        count: g.count,
        intervalTicks: secondsToTicks(g.interval),
        delayTicks: secondsToTicks(g.delay),
        path: g.path,
      };
    });
    return {
      groups,
      hpPct: wave.hpPct,
      bonus: wave.bonus,
      enemyCount: groups.reduce((n, g) => n + g.count, 0),
    };
  });

  const hash = new Hasher().str(JSON.stringify(map)).str(JSON.stringify(def)).hex();

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    width: map.width,
    height: map.height,
    buildable: buildLayer.data.map((gid) => gid !== 0),
    paths,
    startingGold: def.startingGold,
    waves,
    hash,
  };
}

export function isBuildable(level: Level, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return false;
  return level.buildable[ty * level.width + tx] === true;
}

/** Position at a distance along a path. `segment` is a hint that only moves forward. */
export function pointOnPath(
  path: Path,
  distance: number,
  segment: number,
): { x: number; y: number; segment: number } {
  let i = segment;
  while (
    i < path.segments.length - 1 &&
    distance >= path.segments[i]!.start + path.segments[i]!.length
  ) {
    i++;
  }
  const s = path.segments[i]!;
  const t = Math.min(distance - s.start, s.length);
  return {
    x: s.ax + Math.trunc(((s.bx - s.ax) * t) / s.length),
    y: s.ay + Math.trunc(((s.by - s.ay) * t) / s.length),
    segment: i,
  };
}
