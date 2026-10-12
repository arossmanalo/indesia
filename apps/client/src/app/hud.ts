import {
  ECONOMY_STATS,
  type EnemyType,
  sellValue,
  statIndex,
  TICK_RATE,
  TOWER_DEFS,
  towerStats,
  UNITS_PER_TILE,
  upgradeCost,
} from '@indesia/sim';
import { shallowEqual } from '../ui/store';
import type { GameController } from '../game/controller';
import { app, type Hud, type SelectedTower, type UpgradeOption } from './state';

function hudFor(c: GameController): Hud {
  const { state } = c;
  const { level } = c;
  const next = level.waves[state.wavesStarted];
  const counts = new Map<EnemyType, number>();
  for (const g of next?.groups ?? []) counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);
  const counting = state.nextWaveIn > 0;
  return {
    gold: state.gold,
    lives: state.lives,
    wave: state.wavesStarted,
    waves: level.waves.length,
    nextWaveIn: counting ? Math.ceil(state.nextWaveIn / TICK_RATE) : -1,
    canCallWave:
      state.status === 'playing' &&
      state.wavesStarted < level.waves.length &&
      (state.wavesStarted === 0 || counting),
    callBonus: counting
      ? Math.trunc(state.nextWaveIn / TICK_RATE) * ECONOMY_STATS.earlyCallGoldPerSecond
      : 0,
    nextWave: [...counts].map(([enemy, count]) => ({ enemy, count })),
    status: state.status,
  };
}

function selectedFor(c: GameController, id: number): SelectedTower | null {
  const tower = c.state.towers.find((t) => t.id === id);
  if (!tower) return null;
  const def = TOWER_DEFS.find((d) => d.type === tower.type)!;
  const stats = towerStats(tower.type)[statIndex(tower.level, tower.spec)];
  const authored =
    tower.level === 3 ? def.specs[tower.spec === 1 ? 1 : 0] : def.levels[tower.level - 1]!;
  const gold = c.state.gold;

  const upgrades: UpgradeOption[] = [];
  if (tower.level === 1) {
    const cost = upgradeCost(c.game, tower.id)!;
    const next = def.levels[1];
    upgrades.push({
      name: next.name,
      description: next.description,
      cost,
      affordable: gold >= cost,
    });
  } else if (tower.level === 2) {
    for (const branch of [0, 1] as const) {
      const cost = upgradeCost(c.game, tower.id, branch)!;
      const spec = def.specs[branch];
      upgrades.push({
        branch,
        name: spec.name,
        description: spec.description,
        cost,
        affordable: gold >= cost,
      });
    }
  }

  return {
    id: tower.id,
    type: tower.type,
    level: tower.level,
    spec: tower.spec,
    name: authored.name,
    targeting: tower.targeting,
    damage: stats.damage * stats.shots,
    damageType: stats.damageType,
    range: Math.round((stats.range / UNITS_PER_TILE) * 10) / 10,
    rate: Math.round((TICK_RATE / stats.cooldown) * 10) / 10,
    sellValue: sellValue(c.game, tower.id),
    upgrades,
  };
}

function sameSelection(a: SelectedTower | null, b: SelectedTower | null): boolean {
  if (!a || !b) return a === b;
  const { upgrades: ua, ...ra } = a;
  const { upgrades: ub, ...rb } = b;
  return (
    shallowEqual(ra, rb) && ua.length === ub.length && ua.every((u, i) => shallowEqual(u, ub[i]))
  );
}

/** Pushes HUD and selection changes to the UI store (only when something changed). */
export function syncHud(c: GameController): void {
  const { selectedId } = app.get();
  const hud = hudFor(c);
  const prev = app.get().hud;
  const hudChanged =
    !prev ||
    !shallowEqual({ ...prev, nextWave: null }, { ...hud, nextWave: null }) ||
    prev.nextWave.length !== hud.nextWave.length ||
    prev.nextWave.some((g, i) => !shallowEqual(g, hud.nextWave[i]));
  const selected = selectedId === null ? null : selectedFor(c, selectedId);
  const selectionChanged = !sameSelection(app.get().selected, selected);
  if (hudChanged || selectionChanged) {
    app.set({
      ...(hudChanged ? { hud } : {}),
      // A sold tower drops the selection.
      ...(selectionChanged ? { selected, selectedId: selected ? selectedId : null } : {}),
    });
  }
}
