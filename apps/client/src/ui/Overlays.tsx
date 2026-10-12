import { useEffect, useState } from 'preact/hooks';
import { getLevel } from '@indesia/sim';
import { nextLevelId, retryLevel, showLevels, startLevel, togglePause } from '../app/actions';
import { app } from '../app/state';
import { Button, Stars } from './components';
import { useStore } from './store';

/** Shows the latest message of a kind for a while, then hides it. */
function useTimed<T extends { id: number }>(value: T | null, ms: number): T | null {
  const [shown, setShown] = useState<T | null>(null);
  useEffect(() => {
    if (!value) return;
    setShown(value);
    const t = setTimeout(() => setShown(null), ms);
    return () => clearTimeout(t);
  }, [value?.id]);
  return shown;
}

export function Banner() {
  const banner = useTimed(
    useStore(app, (s) => s.banner),
    1800,
  );
  if (!banner) return null;
  return (
    <div key={banner.id} class="banner" role="status">
      {banner.text}
    </div>
  );
}

export function Toast() {
  const toast = useTimed(
    useStore(app, (s) => s.toast),
    1800,
  );
  if (!toast) return null;
  return (
    <div key={toast.id} class="toast" role="status">
      {toast.text}
    </div>
  );
}

export function PauseOverlay() {
  const paused = useStore(app, (s) => s.paused && !s.result);
  if (!paused) return null;
  return (
    <div class="overlay">
      <div class="panel dialog" role="dialog" aria-label="Paused">
        <h2>Paused</h2>
        <Button variant="primary" onClick={togglePause}>
          Resume
        </Button>
        <Button onClick={retryLevel}>Restart</Button>
        <Button variant="ghost" onClick={showLevels}>
          Quit to map select
        </Button>
      </div>
    </div>
  );
}

export function ResultOverlay() {
  const result = useStore(app, (s) => s.result);
  if (!result) return null;
  const won = result.status === 'won';
  const next = won ? nextLevelId(result.levelId) : null;
  return (
    <div class="overlay">
      <div class="panel dialog" role="dialog" aria-label={won ? 'Victory' : 'Defeat'}>
        <h2 class={won ? 'win' : 'lose'}>{won ? 'Victory!' : 'The road has fallen'}</h2>
        <p class="muted">{getLevel(result.levelId)?.name}</p>
        {won ? (
          <>
            <Stars count={result.stars} />
            <p class="score">
              Score {result.score.toLocaleString()}
              {result.newBest && <span class="chip">New best</span>}
            </p>
            <p class="muted">{result.lives} lives left</p>
          </>
        ) : (
          <p class="muted">Rethink your defenses and try again.</p>
        )}
        <div class="dialog__actions">
          {next && (
            <Button variant="primary" onClick={() => startLevel(next)}>
              Next map
            </Button>
          )}
          <Button variant={won ? 'default' : 'primary'} onClick={retryLevel}>
            {won ? 'Replay' : 'Retry'}
          </Button>
          <Button variant="ghost" onClick={showLevels}>
            Map select
          </Button>
        </div>
      </div>
    </div>
  );
}
