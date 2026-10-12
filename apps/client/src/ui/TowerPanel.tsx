import { TARGET_MODES } from '@indesia/sim';
import { selectTower, sellSelected, setTargeting, upgradeSelected } from '../app/actions';
import { app } from '../app/state';
import { Button, Sprite } from './components';
import { useStore } from './store';

const TARGET_LABELS = { first: 'First', last: 'Last', strongest: 'Strong', closest: 'Close' };

export function TowerPanel() {
  const t = useStore(app, (s) => s.selected);
  if (!t) return null;
  const variant = t.level === 1 ? '1' : t.level === 2 ? '2' : t.spec === 1 ? 'b' : 'a';
  return (
    <aside class="panel tower-panel" aria-label={t.name}>
      <header class="tower-panel__head">
        <Sprite frame={`tower-${t.type}-${variant}`} />
        <div>
          <strong>{t.name}</strong>
          <span class="muted">Level {t.level}</span>
        </div>
        <button type="button" class="close" aria-label="Close" onClick={() => selectTower(null)}>
          ×
        </button>
      </header>
      <dl class="tower-panel__stats">
        <dt>Damage</dt>
        <dd>
          {t.damage} {t.damageType === 'magic' ? '✦' : ''}
        </dd>
        <dt>Range</dt>
        <dd>{t.range}</dd>
        <dt>Shots/s</dt>
        <dd>{t.rate}</dd>
      </dl>
      <div class="segmented" role="group" aria-label="Targeting">
        {TARGET_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={t.targeting === m}
            onClick={() => setTargeting(m)}
          >
            {TARGET_LABELS[m]}
          </button>
        ))}
      </div>
      {t.upgrades.map((u) => (
        <button
          key={u.name}
          type="button"
          class="upgrade"
          disabled={!u.affordable}
          onClick={() => upgradeSelected(u.branch)}
        >
          <span class="upgrade__name">
            {u.branch === undefined ? 'Upgrade: ' : ''}
            {u.name}
          </span>
          <span class="upgrade__desc muted">{u.description}</span>
          <span class="upgrade__cost">
            <Sprite frame="icon-coin" />
            {u.cost}
          </span>
        </button>
      ))}
      <Button variant="danger" onClick={sellSelected}>
        Sell for {t.sellValue}
      </Button>
    </aside>
  );
}
