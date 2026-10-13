import { useEffect, useState } from 'preact/hooks';
import { LEVELS } from '@indesia/sim';
import { app } from '../app/state';
import { useStore } from './store';

const KEY = 'indesia.tutorial.v1';

function isDone(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}

function markDone(): void {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    // Hints simply show again next time.
  }
}

type Step = { id: string; text: string; where: 'build' | 'wave' | 'panel' };

/** First-play hints on the first map, derived from what the player has done so far. */
export function Tutorial() {
  const [done, setDone] = useState(isDone);
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const step = useStore(app, (s): Step | null => {
    if (s.levelId !== LEVELS[0]!.id || !s.hud || s.result || s.paused) return null;
    const { hud } = s;
    if (hud.wave === 0) {
      if (s.placing) {
        return {
          id: 'place',
          where: 'build',
          text: touch
            ? 'Tap a grass tile beside the road, then tap it again to build.'
            : 'Click a grass tile beside the road to build. Right-click or Esc cancels.',
        };
      }
      if (hud.towers === 0) {
        return {
          id: 'pick',
          where: 'build',
          text: touch
            ? 'Pick a tower from the bar below to start your defense.'
            : 'Pick a tower from the bar below (or press 1-4) to start your defense.',
        };
      }
      return {
        id: 'start',
        where: 'wave',
        text: 'Build another if you can afford it, then start the first wave.',
      };
    }
    if (hud.wave <= 3 && s.selectedId === null) {
      return {
        id: 'upgrade',
        where: 'panel',
        text: 'Tip: select a tower to upgrade it, change who it targets, or sell it.',
      };
    }
    return null;
  });

  // Seeing the last hint through finishes the tutorial.
  const last = step?.id === 'upgrade';
  useEffect(() => {
    if (!last) return;
    return () => {
      markDone();
      setDone(true);
    };
  }, [last]);

  if (done || !step) return null;
  return (
    <div class={`panel coach coach--${step.where}`} role="note">
      <p>{step.text}</p>
      <button
        type="button"
        class="coach__skip"
        onClick={() => {
          markDone();
          setDone(true);
        }}
      >
        Got it
      </button>
    </div>
  );
}
