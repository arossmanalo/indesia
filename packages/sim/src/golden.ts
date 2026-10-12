import type { BotOptions } from './bot';

/** Games recorded as golden replays (see scripts/golden.ts and golden.test.ts). */
export const GOLDEN_GAMES: { name: string; level: string; seed: number; bot: BotOptions }[] = [
  {
    name: 'meadow-archers',
    level: 'meadow',
    seed: 20261012,
    bot: { mix: ['archer'], maxTowers: 6, maxLevel: 3, branch: { archer: 1 }, callEarly: true },
  },
  {
    name: 'meadow-longbows',
    level: 'meadow',
    seed: 7,
    bot: { mix: ['archer'], maxTowers: 4, maxLevel: 3, branch: { archer: 0 }, callEarly: false },
  },
];
