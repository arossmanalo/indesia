import { useEffect } from 'preact/hooks';
import { ENEMY_DEFS, TOWER_DEFS, TOWER_TYPES, towerStats } from '@indesia/sim';
import {
  beginPlacing,
  callWave,
  cancel,
  cycleSpeed,
  cycleTargeting,
  placeableTowers,
  setSpeed,
  togglePause,
  upgradeSelected,
} from '../app/actions';
import { app } from '../app/state';
import { Button, Sprite } from './components';
import { Banner, PauseOverlay, ResultOverlay } from './Overlays';
import { useStore } from './store';
import { TowerPanel } from './TowerPanel';

function useBattleKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.repeat || app.get().settingsOpen) return;
      const n = Number(e.key);
      if (n >= 1 && n <= TOWER_TYPES.length) {
        beginPlacing(TOWER_TYPES[n - 1]!);
      } else if (e.key === 'Escape') {
        cancel();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      } else if (e.key === 'n' || e.key === 'N') {
        callWave();
      } else if (e.key === 'f' || e.key === 'F') {
        cycleSpeed();
      } else if (e.key === 'u' || e.key === 'U') {
        const s = app.get().selected;
        if (s?.level === 1) upgradeSelected();
      } else if (e.key === 't' || e.key === 'T') {
        cycleTargeting();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function TopBar() {
  const hud = useStore(app, (s) => s.hud);
  const speed = useStore(app, (s) => s.speed);
  const paused = useStore(app, (s) => s.paused);
  if (!hud) return null;
  return (
    <>
      <div class="panel stats" aria-live="polite">
        <span class="stat" title="Lives">
          <Sprite frame="icon-heart" /> {hud.lives}
        </span>
        <span class="stat" title="Gold">
          <Sprite frame="icon-coin" /> {hud.gold}
        </span>
        <span class="stat" title="Wave">
          <Sprite frame="icon-skull" /> {hud.wave}/{hud.waves}
        </span>
      </div>
      <div class="panel controls">
        {([1, 2, 3] as const).map((s) => (
          <Button
            key={s}
            variant="ghost"
            pressed={speed === s}
            onClick={() => setSpeed(s)}
            title={`Speed ${s}x (F)`}
          >
            {s}×
          </Button>
        ))}
        <Button variant="ghost" pressed={paused} onClick={togglePause} title="Pause (Space)">
          {paused ? '▶' : '❚❚'}
        </Button>
      </div>
    </>
  );
}

function BuildBar() {
  const placing = useStore(app, (s) => s.placing);
  const gold = useStore(app, (s) => s.hud?.gold ?? 0);
  const towers = placeableTowers();
  return (
    <nav class="panel build-bar" aria-label="Build towers">
      {towers.map((type) => {
        const cost = towerStats(type)[0].cost;
        const def = TOWER_DEFS.find((d) => d.type === type)!;
        const key = TOWER_TYPES.indexOf(type) + 1;
        return (
          <button
            key={type}
            type="button"
            class="build-btn"
            aria-pressed={placing === type}
            disabled={gold < cost && placing !== type}
            title={`${def.levels[0].name}: ${def.levels[0].description} (${key})`}
            onClick={() => beginPlacing(type)}
          >
            <Sprite frame={`tower-${type}-1`} />
            <span class="build-btn__cost">
              <Sprite frame="icon-coin" />
              {cost}
            </span>
            <kbd>{key}</kbd>
          </button>
        );
      })}
    </nav>
  );
}

function WavePanel() {
  const hud = useStore(app, (s) => s.hud);
  if (!hud || hud.status !== 'playing') return null;
  const first = hud.wave === 0;
  if (hud.wave >= hud.waves && !first) return null;
  return (
    <div class="panel wave-panel">
      {hud.nextWave.length > 0 && (
        <div class="wave-preview" title="Next wave">
          {hud.nextWave.map((g) => (
            <span
              key={g.enemy}
              class="wave-preview__group"
              title={ENEMY_DEFS.find((d) => d.type === g.enemy)?.name}
            >
              <Sprite frame={`enemy-${g.enemy}-0`} />×{g.count}
            </span>
          ))}
        </div>
      )}
      {hud.wave < hud.waves && (
        <Button
          variant="primary"
          onClick={callWave}
          disabled={!hud.canCallWave}
          title="Call the next wave (N)"
        >
          {first
            ? 'Start wave 1'
            : hud.nextWaveIn > 0
              ? `Next wave in ${hud.nextWaveIn}s · +${hud.callBonus}`
              : 'Wave incoming…'}
        </Button>
      )}
    </div>
  );
}

export function Battle() {
  useBattleKeys();
  const placing = useStore(app, (s) => s.placing);
  return (
    <div class="stage">
      <TopBar />
      <WavePanel />
      <BuildBar />
      <TowerPanel />
      {placing && <p class="hint panel">Tap a free tile to place · Esc to cancel</p>}
      <Banner />
      <PauseOverlay />
      <ResultOverlay />
    </div>
  );
}
