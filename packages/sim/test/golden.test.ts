import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getLevel } from '../src/levels';
import { type Outcome, Replay, runReplay } from '../src/replay';

// Recorded games must keep producing exactly the same result. If this fails after an
// intentional rules change, bump SIM_VERSION and run `pnpm --filter @indesia/sim golden:update`.
const dir = join(import.meta.dirname, '..', 'replays');
const files = readdirSync(dir).filter((f) => f.endsWith('.golden.json'));

describe('golden replays', () => {
  it('exist', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(file, () => {
      const json = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
        expected: Outcome;
        replay: unknown;
      };
      const replay = Replay.parse(json.replay);
      const result = runReplay(getLevel(replay.levelId)!, replay);
      expect(result).toEqual({ ok: true, outcome: json.expected });
    });
  }
});
