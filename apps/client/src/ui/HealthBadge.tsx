import { useEffect, useState } from 'preact/hooks';
import { HealthResponse } from '@indesia/shared';
import './HealthBadge.css';

type State = { kind: 'loading' } | { kind: 'online'; health: HealthResponse } | { kind: 'offline' };

export function HealthBadge() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((json) => setState({ kind: 'online', health: HealthResponse.parse(json) }))
      .catch(() => setState({ kind: 'offline' }));
  }, []);

  const [tone, label] =
    state.kind === 'loading'
      ? ['muted', 'Connecting…']
      : state.kind === 'offline'
        ? ['bad', 'Offline mode']
        : state.health.db === 'ok'
          ? ['ok', `Online · sim v${state.health.simVersion}`]
          : ['warn', `API up · db ${state.health.db}`];

  return <div class={`health-badge health-badge--${tone}`}>{label}</div>;
}
