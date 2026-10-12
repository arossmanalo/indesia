import { createAuthClient } from 'better-auth/client';
import { anonymousClient } from 'better-auth/client/plugins';
import {
  ConfigResponse,
  type GameEndEvent,
  LeaderboardResponse,
  Save,
  SubmitScoreResponse,
} from '@indesia/shared';
import { Replay } from '@indesia/sim';
import { z } from 'zod';
import { writeSave } from './save';
import { app, type SubmitStatus } from './state';

/**
 * Everything that talks to the server. The game never waits on it: progress is saved
 * locally first, and scores wait in a queue until the server can verify them.
 */

const auth = createAuthClient({ plugins: [anonymousClient()] });

const PENDING_KEY = 'indesia.pending.v1';
const Pending = z.array(z.object({ id: z.string(), replay: Replay }));
type Pending = z.infer<typeof Pending>;

function readPending(): Pending {
  try {
    const parsed = Pending.safeParse(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]'));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writePending(items: Pending): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch {
    // The queue lives on in memory for this session.
  }
}

async function api<T>(
  path: string,
  schema: z.ZodType<T> | null,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return schema ? schema.parse(await res.json()) : (undefined as T);
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Signs in (as a guest if needed), then syncs the save and flushes queued scores. */
export async function goOnline(): Promise<void> {
  try {
    const config = await api('/config', ConfigResponse);
    let session = (await auth.getSession()).data;
    if (!session) {
      await auth.signIn.anonymous();
      session = (await auth.getSession()).data;
    }
    if (!session) throw new Error('no session');
    const user = session.user as { name: string; isAnonymous?: boolean | null };
    app.set({
      online: {
        status: 'online',
        name: user.name,
        guest: user.isAnonymous === true,
        providers: config.providers,
      },
    });
    await syncSave();
    await flushScores();
  } catch {
    app.set({ online: { ...app.get().online, status: 'offline' } });
  }
}

export async function syncSave(): Promise<void> {
  if (app.get().online.status !== 'online') return;
  try {
    const { save } = await api('/save', z.object({ save: Save }), {
      method: 'PUT',
      body: JSON.stringify(app.get().save),
    });
    writeSave(save);
    app.set({ save });
  } catch {
    // Retried on the next sync.
  }
}

/** Queues a winning replay for server verification and tries to submit it now. */
export function queueScore(replay: Replay): string {
  const id = `${replay.levelId}-${replay.seed}-${replay.commands.length}-${Date.now()}`;
  writePending([...readPending(), { id, replay }]);
  void flushScores();
  return id;
}

let flushing: Promise<void> | null = null;

/** Submits queued scores one at a time; concurrent calls share the same run. */
export function flushScores(): Promise<void> {
  // Clear in .finally (always async) so a run that finishes immediately can't leave a
  // stale promise behind.
  flushing ??= submitQueued().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function submitQueued(): Promise<void> {
  for (const item of readPending()) {
    const settle = () => writePending(readPending().filter((p) => p.id !== item.id));
    try {
      const res = await api('/scores', SubmitScoreResponse, {
        method: 'POST',
        body: JSON.stringify({ replay: item.replay }),
      });
      settle();
      reportSubmit(item.id, { state: 'verified', rank: res.rank });
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
        // The server re-ran the game and disagreed (or the rules changed): drop it.
        settle();
        reportSubmit(item.id, { state: 'rejected', reason: e.message });
      } else {
        reportSubmit(item.id, { state: 'queued' });
        return;
      }
    }
  }
}

function reportSubmit(id: string, submit: SubmitStatus): void {
  const current = app.get().submit;
  if (current?.id === id) app.set({ submit: { id, status: submit } });
}

export async function fetchLeaderboard(levelId: string): Promise<LeaderboardResponse> {
  return api(`/leaderboard/${encodeURIComponent(levelId)}`, LeaderboardResponse);
}

export function sendTelemetry(event: GameEndEvent): void {
  void api('/telemetry', null, { method: 'POST', body: JSON.stringify({ events: [event] }) }).catch(
    () => undefined,
  );
}

/** Links a social account to the current guest (progress and scores carry over). */
export async function linkAccount(provider: 'github' | 'google'): Promise<void> {
  await auth.signIn.social({ provider, callbackURL: '/' });
}

export async function signOut(): Promise<void> {
  await auth.signOut();
  await goOnline();
}

/** Keeps trying to reach the server while the game runs, backing off while offline. */
export function startOnlineLoop(): void {
  let failures = 0;
  const tick = async () => {
    if (app.get().online.status !== 'online') await goOnline();
    else await flushScores();
    failures = app.get().online.status === 'online' ? 0 : failures + 1;
    const delay = failures === 0 ? 60_000 : Math.min(60_000, 3_000 * 2 ** (failures - 1));
    setTimeout(() => void tick(), delay);
  };
  void tick();
  window.addEventListener('online', () => void goOnline());
}
