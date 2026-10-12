import { z } from 'zod';
import { ECONOMY_STATS, hasTower, statIndex, towerStats } from './content/compiled';
import { TargetMode, TowerType } from './content/schema';
import { isBuildable } from './level';
import { percentOf, tileCenter, TICK_RATE } from './math';
import type { Game } from './state';
import { startNextWave } from './systems/waves';

export const Command = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('build'),
    tower: TowerType,
    tx: z.number().int(),
    ty: z.number().int(),
  }),
  z.object({
    type: z.literal('upgrade'),
    towerId: z.number().int(),
    /** Required when upgrading from level 2 to a level-3 specialization. */
    branch: z.union([z.literal(0), z.literal(1)]).optional(),
  }),
  z.object({ type: z.literal('sell'), towerId: z.number().int() }),
  z.object({ type: z.literal('target'), towerId: z.number().int(), mode: TargetMode }),
  z.object({ type: z.literal('callWave') }),
]);
export type Command = z.infer<typeof Command>;

export const TimedCommand = z.intersection(
  z.object({ tick: z.number().int().nonnegative() }),
  Command,
);
export type TimedCommand = z.infer<typeof TimedCommand>;

export type CommandResult = { ok: true } | { ok: false; reason: string };

const OK: CommandResult = { ok: true };
const fail = (reason: string): CommandResult => ({ ok: false, reason });

/** Cost of the next upgrade for a tower, or null when it is fully upgraded. */
export function upgradeCost(game: Game, towerId: number, branch: 0 | 1 = 0): number | null {
  const tower = game.state.towers.find((t) => t.id === towerId);
  if (!tower || tower.level >= 3) return null;
  const table = towerStats(tower.type);
  return tower.level === 1 ? table[1].cost : table[statIndex(3, branch)].cost;
}

export function sellValue(game: Game, towerId: number): number {
  const tower = game.state.towers.find((t) => t.id === towerId);
  return tower ? percentOf(tower.spent, ECONOMY_STATS.sellRefundPct) : 0;
}

/** Validates and applies a command. Invalid commands change nothing. */
export function applyCommand(game: Game, cmd: Command): CommandResult {
  const { state, level } = game;
  if (state.status !== 'playing') return fail('game over');

  switch (cmd.type) {
    case 'build': {
      if (!hasTower(cmd.tower)) return fail('unknown tower');
      if (!isBuildable(level, cmd.tx, cmd.ty)) return fail('cannot build here');
      if (state.towers.some((t) => t.tx === cmd.tx && t.ty === cmd.ty))
        return fail('tile occupied');
      const cost = towerStats(cmd.tower)[0].cost;
      if (state.gold < cost) return fail('not enough gold');
      state.gold -= cost;
      const id = state.nextId++;
      state.towers.push({
        id,
        type: cmd.tower,
        tx: cmd.tx,
        ty: cmd.ty,
        x: tileCenter(cmd.tx),
        y: tileCenter(cmd.ty),
        level: 1,
        spec: -1,
        targeting: 'first',
        cooldown: 0,
        spent: cost,
      });
      state.stats.towersBuilt++;
      state.events.push({ type: 'build', towerId: id });
      return OK;
    }

    case 'upgrade': {
      const tower = state.towers.find((t) => t.id === cmd.towerId);
      if (!tower) return fail('no such tower');
      if (tower.level >= 3) return fail('fully upgraded');
      if (tower.level === 2 && cmd.branch === undefined) return fail('choose a specialization');
      const branch = cmd.branch ?? 0;
      const cost = upgradeCost(game, tower.id, branch)!;
      if (state.gold < cost) return fail('not enough gold');
      state.gold -= cost;
      tower.spent += cost;
      tower.level++;
      if (tower.level === 3) tower.spec = branch;
      state.events.push({ type: 'upgrade', towerId: tower.id });
      return OK;
    }

    case 'sell': {
      const index = state.towers.findIndex((t) => t.id === cmd.towerId);
      if (index < 0) return fail('no such tower');
      const tower = state.towers[index]!;
      const refund = sellValue(game, tower.id);
      state.gold += refund;
      state.towers.splice(index, 1);
      state.events.push({ type: 'sell', towerId: tower.id, tx: tower.tx, ty: tower.ty, refund });
      return OK;
    }

    case 'target': {
      const tower = state.towers.find((t) => t.id === cmd.towerId);
      if (!tower) return fail('no such tower');
      tower.targeting = cmd.mode;
      return OK;
    }

    case 'callWave': {
      if (state.wavesStarted >= level.waves.length) return fail('no waves left');
      const first = state.wavesStarted === 0;
      if (!first && state.nextWaveIn < 0) return fail('current wave still arriving');
      const bonus = first
        ? 0
        : Math.trunc(state.nextWaveIn / TICK_RATE) * ECONOMY_STATS.earlyCallGoldPerSecond;
      state.gold += bonus;
      state.stats.earlyCallGold += bonus;
      startNextWave(game, !first, bonus);
      return OK;
    }
  }
}
