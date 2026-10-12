/**
 * Records the golden replays checked by golden.test.ts. Run after an intentional change to
 * the simulation (and bump SIM_VERSION if outcomes changed):
 *   pnpm --filter @indesia/sim golden:update
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_GAMES } from '../src/golden';
import { getLevel, playBotGame, runReplay } from '../src/index';

for (const g of GOLDEN_GAMES) {
  const level = getLevel(g.level)!;
  const replay = playBotGame(level, g.seed, g.bot);
  const result = runReplay(level, replay);
  if (!result.ok) throw new Error(`${g.name}: ${result.reason}`);
  const file = join(import.meta.dirname, '..', 'replays', `${g.name}.golden.json`);
  writeFileSync(file, JSON.stringify({ expected: result.outcome, replay }) + '\n');
  console.log(
    `${g.name}: ${result.outcome.status}, ${result.outcome.stars} stars, hash ${result.outcome.hash}`,
  );
}
