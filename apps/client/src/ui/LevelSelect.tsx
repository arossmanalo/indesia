import { LEVELS } from '@indesia/sim';
import { showTitle, startLevel } from '../app/actions';
import { isUnlocked } from '../app/save';
import { app } from '../app/state';
import { Button, Stars } from './components';
import { useStore } from './store';

export function LevelSelect() {
  const save = useStore(app, (s) => s.save);
  return (
    <main class="screen levels">
      <h2>Choose a battlefield</h2>
      <ol class="level-list">
        {LEVELS.map((level, i) => {
          const unlocked = isUnlocked(save, i);
          const progress = save.levels[level.id];
          return (
            <li key={level.id}>
              <button
                type="button"
                class="level-card"
                disabled={!unlocked}
                onClick={() => startLevel(level.id)}
              >
                <span class="level-card__num">{i + 1}</span>
                <span class="level-card__body">
                  <strong>{level.name}</strong>
                  <span class="muted">
                    {unlocked ? level.description : 'Beat the previous map to unlock.'}
                  </span>
                </span>
                <span class="level-card__meta">
                  <Stars count={progress?.stars ?? 0} />
                  {progress && progress.bestScore > 0 && (
                    <span class="muted">Best {progress.bestScore.toLocaleString()}</span>
                  )}
                  <span class="muted">{level.waves.length} waves</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" onClick={showTitle}>
        Back
      </Button>
    </main>
  );
}
