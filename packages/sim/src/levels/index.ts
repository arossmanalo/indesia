import { compileLevel, type Level } from '../level';
import meadowLevel from './meadow/level.json';
import meadowMap from './meadow/map.json';

/** Campaign levels in unlock order. */
export const LEVELS: readonly Level[] = [compileLevel(meadowMap, meadowLevel)];

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}
