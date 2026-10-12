import { emptySave, Save } from '@indesia/shared';
import { LEVELS, type Outcome } from '@indesia/sim';

const KEY = 'indesia.save.v1';

/** Reads the local save. Storage may be unavailable (private mode, blocked): start fresh. */
export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    const parsed = Save.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptySave();
  } catch {
    return emptySave();
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Progress still lives in memory for this session.
  }
}

/** Applies a finished game to the save; returns the new save and whether it was a new best. */
export function recordOutcome(
  save: Save,
  levelId: string,
  outcome: Outcome,
): { save: Save; newBest: boolean } {
  const prev = save.levels[levelId] ?? { stars: 0, bestScore: 0 };
  if (outcome.status !== 'won') return { save, newBest: false };
  const newBest = outcome.score > prev.bestScore;
  return {
    newBest,
    save: {
      ...save,
      levels: {
        ...save.levels,
        [levelId]: {
          stars: Math.max(prev.stars, outcome.stars),
          bestScore: Math.max(prev.bestScore, outcome.score),
        },
      },
    },
  };
}

/** The first level is always open; each later one opens once the previous is beaten. */
export function isUnlocked(save: Save, index: number): boolean {
  if (index === 0) return true;
  const prev = LEVELS[index - 1];
  return prev !== undefined && (save.levels[prev.id]?.stars ?? 0) > 0;
}
