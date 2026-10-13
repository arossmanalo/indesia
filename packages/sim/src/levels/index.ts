import { compileLevel, type Level } from '../level';
import fenLevel from './fen/level.json';
import fenMap from './fen/map.json';
import meadowLevel from './meadow/level.json';
import meadowMap from './meadow/map.json';
import passLevel from './pass/level.json';
import passMap from './pass/map.json';

/** Campaign levels in unlock order: the Tiled map and the level definition. */
const SOURCES: { map: unknown; level: unknown }[] = [
  { map: meadowMap, level: meadowLevel },
  { map: fenMap, level: fenLevel },
  { map: passMap, level: passLevel },
];

export const LEVELS: readonly Level[] = SOURCES.map((s) => compileLevel(s.map, s.level));

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** The raw Tiled map of a level, for renderers. */
export function getLevelMap(id: string): unknown {
  const index = LEVELS.findIndex((l) => l.id === id);
  return index < 0 ? undefined : SOURCES[index]!.map;
}
