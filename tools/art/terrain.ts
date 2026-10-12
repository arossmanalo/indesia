/**
 * Layout of the terrain tileset (apps/client/public/assets/terrain.png): 8 columns of
 * 32x32 tiles. Shared by the art generator and the map tool so tile ids stay in sync.
 */
export const TERRAIN_COLUMNS = 8;
export const TERRAIN_ROWS = 4;

export const T = {
  grass: [0, 1, 2, 3],
  flowers: 4,
  tallGrass: 5,
  /** Path autotile: PATH_BASE + mask, mask bits N=1, E=2, S=4, W=8. */
  pathBase: 8,
  rock: 24,
  tree: 25,
  water: 26,
  bush: 27,
  /** Marker painted on the hidden "buildable" layer. */
  buildMarker: 28,
} as const;

export const PATH_N = 1;
export const PATH_E = 2;
export const PATH_S = 4;
export const PATH_W = 8;
