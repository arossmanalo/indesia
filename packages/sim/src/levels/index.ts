import { compileLevel, type Level } from '../level';
import meadowLevel from './meadow/level.json';
import meadowMap from './meadow/map.json';

/** Campaign levels in unlock order: the Tiled map and the level definition. */
const SOURCES: { map: unknown; level: unknown }[] = [{ map: meadowMap, level: meadowLevel }];

export const LEVELS: readonly Level[] = SOURCES.map((s) => compileLevel(s.map, s.level));

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

/** The raw Tiled map of a level, for renderers. */
export function getLevelMap(id: string): unknown {
  const index = LEVELS.findIndex((l) => l.id === id);
  return index < 0 ? undefined : SOURCES[index]!.map;
}
