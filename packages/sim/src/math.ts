/**
 * Integer-only geometry. Positions are in "units": 1 tile = UNITS_PER_TILE units.
 * Everything that can affect the outcome of a game is an integer, so the simulation
 * produces identical results on every JavaScript engine.
 */
export const TICK_RATE = 30;
export const UNITS_PER_TILE = 1024;
export const TILE_PX = 32;
export const UNITS_PER_PX = UNITS_PER_TILE / TILE_PX;

/** floor(sqrt(n)). IEEE-754 sqrt is correctly rounded, so this is deterministic. */
export function isqrt(n: number): number {
  return Math.floor(Math.sqrt(n));
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function percentOf(value: number, pct: number): number {
  return Math.trunc((value * pct) / 100);
}

export function tileCenter(tile: number): number {
  return tile * UNITS_PER_TILE + UNITS_PER_TILE / 2;
}

// Conversions from human-friendly content units. Content is static, so rounding here is
// deterministic; nothing at runtime uses floating point.
export function tilesToUnits(tiles: number): number {
  return Math.round(tiles * UNITS_PER_TILE);
}

export function secondsToTicks(seconds: number): number {
  return Math.round(seconds * TICK_RATE);
}

export function tilesPerSecondToUnitsPerTick(tilesPerSecond: number): number {
  return Math.max(1, Math.round((tilesPerSecond * UNITS_PER_TILE) / TICK_RATE));
}
