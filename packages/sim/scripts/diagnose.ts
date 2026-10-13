// Per-wave diagnostics for one level and bot (WIP balancing aid).
// Usage: npx tsx packages/sim/scripts/diagnose.ts <levelId> [botOptionsJson]
import {
  clearEvents,
  createBot,
  createGame,
  getLevel,
  REFERENCE_BOT,
  step,
  type BotOptions,
} from '../src/index';
const id = process.argv[2] ?? 'meadow';
const bot: BotOptions = process.argv[3]
  ? (JSON.parse(process.argv[3]) as BotOptions)
  : REFERENCE_BOT;
const level = getLevel(id)!;
const game = createGame(level, 1);
const think = createBot(level, bot);
let lastWave = 0;
const goldAt: number[] = [];
const towersAt: number[] = [];
const levelsAt: number[] = [];
while (game.state.status === 'playing' && game.state.tick < 200000) {
  think(game);
  step(game);
  clearEvents(game.state);
  if (game.state.wavesStarted !== lastWave) {
    lastWave = game.state.wavesStarted;
    goldAt[lastWave] = game.state.gold;
    towersAt[lastWave] = game.state.towers.length;
    levelsAt[lastWave] = game.state.towers.reduce((n, t) => n + t.level, 0);
  }
}
console.log(
  id,
  game.state.status,
  'lives',
  game.state.lives,
  'ticks',
  game.state.tick,
  'killGold',
  game.state.stats.killGold,
);
console.log('wave lost gold towers lvls');
game.state.stats.livesLostPerWave.forEach((l, i) =>
  console.log(
    String(i + 1).padStart(4),
    String(l).padStart(4),
    String(goldAt[i + 1] ?? '-').padStart(5),
    String(towersAt[i + 1] ?? '-').padStart(5),
    String(levelsAt[i + 1] ?? '-').padStart(5),
  ),
);
console.log(
  'towers:',
  game.state.towers
    .map((t) => `${t.type[0]}${t.level}${t.spec >= 0 ? 'ab'[t.spec] : ''}@${t.tx},${t.ty}`)
    .join(' '),
);
