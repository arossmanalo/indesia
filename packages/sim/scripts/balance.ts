/**
 * Prints a balance report for every campaign level: wave strength and how the reference
 * and weak bots fare. Usage: pnpm --filter @indesia/sim balance [levelId]
 */
import {
  checkBalance,
  checkLevel,
  enemyStats,
  LEVELS,
  playBot,
  REFERENCE_BOT,
  WEAK_BOT,
} from '../src/index';

const only = process.argv[2];
let failures = 0;

for (const level of LEVELS.filter((l) => !only || l.id === only)) {
  console.log(
    `\n${level.name} (${level.id}) · ${level.waves.length} waves · ${level.startingGold} gold`,
  );
  console.log('wave  enemies  total hp   (×armor/mr-weighted)  bonus');
  level.waves.forEach((wave, i) => {
    let hp = 0;
    let weighted = 0;
    for (const g of wave.groups) {
      const s = enemyStats(g.enemy);
      const each = Math.trunc((s.hp * wave.hpPct) / 100);
      hp += each * g.count;
      weighted += (each * g.count * 100) / (100 - Math.min(s.armor, s.magicResist));
    }
    const kinds = wave.groups.map((g) => `${g.count}${g.enemy[0]}`).join(' ');
    console.log(
      `${String(i + 1).padStart(4)}  ${kinds.padEnd(16)} ${String(hp).padStart(6)}   ${String(Math.round(weighted)).padStart(6)}            ${wave.bonus}`,
    );
  });

  const describe = (name: string, results: ReturnType<typeof playBot>) =>
    console.log(
      `${name}: ` +
        results
          .map(
            ({ seed, outcome: o }) => `seed ${seed} ${o.status} ${o.lives}♥ ${o.stars}★ ${o.score}`,
          )
          .join(' | '),
    );
  describe('reference bot', playBot(level, REFERENCE_BOT));
  describe('weak bot     ', playBot(level, WEAK_BOT));

  const issues = [...checkLevel(level), ...checkBalance(level)];
  for (const issue of issues) console.log(`  ✗ ${issue}`);
  if (issues.length === 0) console.log('  ✓ valid');
  failures += issues.length;
}
process.exit(failures > 0 ? 1 : 0);
