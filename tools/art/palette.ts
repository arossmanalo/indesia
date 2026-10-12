/**
 * The locked Indesia palette. Every sprite and tile is drawn only with these colors
 * (AI-made or hand-made art is mapped onto them before it ships).
 */
export const PALETTE = {
  '.': [0, 0, 0, 0],
  k: [0x1a, 0x14, 0x23, 255], // outline
  K: [0x3b, 0x2d, 0x4a, 255], // deep shadow
  g: [0x2f, 0x5d, 0x3a, 255], // dark green
  G: [0x4f, 0x8a, 0x3c, 255], // green
  L: [0x8c, 0xc1, 0x52, 255], // light green
  y: [0xd7, 0xe3, 0x6a, 255], // lime highlight
  d: [0x6b, 0x4a, 0x32, 255], // dark brown
  D: [0x9a, 0x6a, 0x3f, 255], // brown
  t: [0xc9, 0x9a, 0x5b, 255], // tan
  T: [0xe6, 0xc4, 0x8a, 255], // sand
  s: [0x5a, 0x5a, 0x6e, 255], // dark stone
  S: [0x8a, 0x8a, 0xa0, 255], // stone
  W: [0xc8, 0xc8, 0xd8, 255], // light stone
  w: [0xf4, 0xef, 0xe6, 255], // white
  r: [0xa8, 0x32, 0x3a, 255], // dark red
  R: [0xe2, 0x57, 0x4c, 255], // red
  o: [0xe8, 0x91, 0x3a, 255], // orange
  Y: [0xf2, 0xc1, 0x4e, 255], // gold
  b: [0x2b, 0x4c, 0x7e, 255], // dark blue
  B: [0x3f, 0x7f, 0xbf, 255], // blue
  c: [0x7f, 0xd1, 0xe8, 255], // ice
  p: [0x5b, 0x3a, 0x8a, 255], // dark purple
  P: [0x9a, 0x6a, 0xd1, 255], // purple
  h: [0xe0, 0xb4, 0x8a, 255], // skin
  H: [0xb0, 0x78, 0x50, 255], // dark skin
  // Translucent ghost tones for wraiths.
  v: [0x9a, 0x6a, 0xd1, 150],
  V: [0xd8, 0xc8, 0xf4, 170],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type PaletteKey = keyof typeof PALETTE;

export function color(key: string): readonly [number, number, number, number] {
  const c = (PALETTE as Record<string, readonly [number, number, number, number]>)[key];
  if (!c) throw new Error(`Color "${key}" is not in the palette`);
  return c;
}
