import { useEffect, useState } from 'preact/hooks';
import type { LeaderboardResponse } from '@indesia/shared';
import { LEVELS } from '@indesia/sim';
import { showTitle } from '../app/actions';
import { fetchLeaderboard } from '../app/online';
import { app } from '../app/state';
import { Button, Stars } from './components';
import { useStore } from './store';

type Load = { kind: 'loading' } | { kind: 'ok'; board: LeaderboardResponse } | { kind: 'error' };

export function Leaderboard() {
  const levelId = useStore(app, (s) => s.boardLevelId) ?? LEVELS[0]!.id;
  const online = useStore(app, (s) => s.online.status);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    setLoad({ kind: 'loading' });
    fetchLeaderboard(levelId)
      .then((board) => live && setLoad({ kind: 'ok', board }))
      .catch(() => live && setLoad({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [levelId, online]);

  return (
    <main class="screen board">
      <h2>Leaderboards</h2>
      <div class="segmented tabs" role="tablist">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === levelId}
            aria-pressed={l.id === levelId}
            onClick={() => app.set({ boardLevelId: l.id })}
          >
            {l.name}
          </button>
        ))}
      </div>
      <section class="panel board-panel" aria-live="polite">
        {load.kind === 'loading' && <p class="muted">Fetching the honour roll…</p>}
        {load.kind === 'error' && (
          <p class="muted">
            The leaderboard is out of reach right now. Your scores wait safely on this device.
          </p>
        )}
        {load.kind === 'ok' && (
          <>
            <p class="muted">Season {load.board.season} · every score verified by replay</p>
            {load.board.entries.length === 0 ? (
              <p>No victories yet this season. Be the first.</p>
            ) : (
              <ol class="board-list">
                {load.board.entries.map((e) => (
                  <li key={e.rank} class={e.you ? 'you' : ''}>
                    <span class="rank">#{e.rank}</span>
                    <span class="name">{e.name}</span>
                    <Stars count={e.stars} />
                    <span class="score">{e.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
            {load.board.you && !load.board.entries.some((e) => e.you) && (
              <p class="you-row">
                You: #{load.board.you.rank} · {load.board.you.score.toLocaleString()}
              </p>
            )}
          </>
        )}
      </section>
      <Button variant="ghost" onClick={showTitle}>
        Back
      </Button>
    </main>
  );
}
