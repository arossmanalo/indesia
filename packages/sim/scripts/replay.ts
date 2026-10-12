/**
 * Re-runs a replay and prints its outcome.
 * Usage: pnpm --filter @indesia/sim replay <replay.json | golden.json>
 */
import { readFileSync } from 'node:fs';
import { getLevel, Replay, runReplay } from '../src/index';

const file = process.argv[2];
if (!file) {
  console.error('Usage: replay <file.json>');
  process.exit(1);
}
const json = JSON.parse(readFileSync(file, 'utf8')) as { replay?: unknown };
const replay = Replay.parse(json.replay ?? json);
const level = getLevel(replay.levelId);
if (!level) {
  console.error(`Unknown level: ${replay.levelId}`);
  process.exit(1);
}
const result = runReplay(level, replay);
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
