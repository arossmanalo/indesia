import type { BotOptions } from './bot';
import { REFERENCE_BOT } from './validate';

/** Games recorded as golden replays (see scripts/golden.ts and golden.test.ts). */
export const GOLDEN_GAMES: { name: string; level: string; seed: number; bot: BotOptions }[] = [
  {
    name: 'meadow-archers',
    level: 'meadow',
    seed: 20261012,
    bot: { mix: ['archer'], maxTowers: 6, maxLevel: 3, branch: { archer: 1 }, callEarly: true },
  },
  {
    name: 'meadow-reference',
    level: 'meadow',
    seed: 7,
    bot: REFERENCE_BOT,
  },
  {
    name: 'pass-reference',
    level: 'pass',
    seed: 11,
    bot: REFERENCE_BOT,
  },
];
