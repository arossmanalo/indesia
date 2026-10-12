import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  ConfigResponse,
  emptySave,
  HealthResponse,
  LeaderboardResponse,
  Save,
  SubmitScoreResponse,
} from '@indesia/shared';
import { getLevel, playBotGame, SIM_VERSION } from '@indesia/sim';
import { createAuth } from './auth';
import { createApp, type Env, type Services } from './app';
import { connect } from './db/client';
import { scores, seasons } from './db/schema';
import { mergeStoredSaves, getSave } from './services/saves';

const ORIGIN = 'http://localhost:5173';
const level = getLevel('meadow')!;
const winning = {
  mix: ['archer' as const],
  maxTowers: 4,
  maxLevel: 3,
  branch: { archer: 0 as const },
  callEarly: false,
};

let services: Services;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  const env: Env = { NODE_ENV: 'test' };
  const db = (await connect(env))!;
  services = { db, auth: createAuth(db, env), env, simVersion: SIM_VERSION };
  app = createApp(() => Promise.resolve(services));
});

async function guest(): Promise<string> {
  const res = await app.request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json' },
    body: '{}',
  });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0]!;
}

function request(path: string, cookie: string | null, init: RequestInit = {}) {
  return app.request(path, {
    ...init,
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

describe('health', () => {
  it('reports the database as ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toMatchObject({ status: 'ok', db: 'ok' });
  });

  it('reports an unconfigured database and refuses data routes', async () => {
    const offline = createApp(() => Promise.resolve(null));
    const health = HealthResponse.parse(await (await offline.request('/api/health')).json());
    expect(health.db).toBe('unconfigured');
    expect((await offline.request('/api/config')).status).toBe(503);
  });

  it('returns JSON 404s', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
  });
});

describe('guests', () => {
  it('can sign in anonymously and read the config', async () => {
    const cookie = await guest();
    const res = await request('/api/config', cookie);
    const config = ConfigResponse.parse(await res.json());
    expect(config.providers).toEqual([]);
    expect(config.season).toBeGreaterThan(0);
  });
});

describe('scores', () => {
  it('requires a session', async () => {
    const res = await request('/api/scores', null, { method: 'POST', body: '{}' });
    expect(res.status).toBe(401);
  });

  it('verifies a winning replay and ranks it', async () => {
    const cookie = await guest();
    const replay = playBotGame(level, 7, winning);
    const res = await request('/api/scores', cookie, {
      method: 'POST',
      body: JSON.stringify({ replay }),
    });
    expect(res.status).toBe(201);
    const body = SubmitScoreResponse.parse(await res.json());
    expect(body.rank).toBeGreaterThanOrEqual(1);

    const board = LeaderboardResponse.parse(
      await (await request('/api/leaderboard/meadow', cookie)).json(),
    );
    expect(board.you).toMatchObject({ score: body.score, you: true });
    expect(board.entries.some((e) => e.you)).toBe(true);
  });

  it('rejects a tampered replay', async () => {
    const cookie = await guest();
    const replay = playBotGame(level, 7, winning);
    const build = replay.commands.findIndex((c) => c.type === 'build');
    replay.commands[build] = {
      tick: replay.commands[build]!.tick,
      type: 'build',
      tower: 'archer',
      tx: 4,
      ty: 2,
    };
    const res = await request('/api/scores', cookie, {
      method: 'POST',
      body: JSON.stringify({ replay }),
    });
    expect(res.status).toBe(422);
  });

  it('does not rank defeats', async () => {
    const cookie = await guest();
    const replay = playBotGame(level, 3, {
      mix: ['archer'],
      maxTowers: 1,
      maxLevel: 1,
      callEarly: true,
    });
    const res = await request('/api/scores', cookie, {
      method: 'POST',
      body: JSON.stringify({ replay }),
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'only victories are ranked' });
  });

  it('rejects malformed bodies and unknown levels', async () => {
    const cookie = await guest();
    expect((await request('/api/scores', cookie, { method: 'POST', body: 'nope' })).status).toBe(
      400,
    );
    const replay = { ...playBotGame(level, 7, winning), levelId: 'atlantis' };
    expect(
      (await request('/api/scores', cookie, { method: 'POST', body: JSON.stringify({ replay }) }))
        .status,
    ).toBe(404);
    expect((await request('/api/leaderboard/atlantis', cookie)).status).toBe(404);
  });

  it('starts a fresh season when the rules version changes', async () => {
    const cookie = await guest();
    const next = createApp(() => Promise.resolve({ ...services, simVersion: SIM_VERSION + 1 }));
    const board = LeaderboardResponse.parse(
      await (await next.request('/api/leaderboard/meadow', { headers: { cookie } })).json(),
    );
    expect(board.entries).toEqual([]);
    const all = await services.db.select().from(seasons);
    const old = all.find((s) => s.simVersion === SIM_VERSION)!;
    expect(old.archivedAt).not.toBeNull();
    // Old scores are kept, just no longer ranked.
    expect(
      (await services.db.select().from(scores).where(eq(scores.seasonId, old.id))).length,
    ).toBeGreaterThan(0);
  });
});

describe('saves', () => {
  it('merges uploads without losing progress', async () => {
    const cookie = await guest();
    const first: Save = { ...emptySave(), levels: { meadow: { stars: 3, bestScore: 100 } } };
    await request('/api/save', cookie, { method: 'PUT', body: JSON.stringify(first) });
    const second: Save = { ...emptySave(), levels: { meadow: { stars: 1, bestScore: 900 } } };
    const res = await request('/api/save', cookie, { method: 'PUT', body: JSON.stringify(second) });
    const { save } = (await res.json()) as { save: Save };
    expect(save.levels.meadow).toEqual({ stars: 3, bestScore: 900 });

    const got = (await (await request('/api/save', cookie)).json()) as { save: Save };
    expect(got.save.levels.meadow).toEqual({ stars: 3, bestScore: 900 });
  });

  it('rejects malformed saves and anonymous access', async () => {
    const cookie = await guest();
    expect(
      (await request('/api/save', cookie, { method: 'PUT', body: '{"version":9}' })).status,
    ).toBe(400);
    expect((await request('/api/save', null)).status).toBe(401);
  });

  it('folds a guest save into a linked account', async () => {
    const a = await guest();
    const b = await guest();
    const idOf = async (cookie: string) =>
      (await services.auth.api.getSession({ headers: new Headers({ cookie }) }))!.user.id;
    await request('/api/save', a, {
      method: 'PUT',
      body: JSON.stringify({ ...emptySave(), levels: { meadow: { stars: 2, bestScore: 50 } } }),
    });
    await request('/api/save', b, {
      method: 'PUT',
      body: JSON.stringify({ ...emptySave(), levels: { fen: { stars: 1, bestScore: 5 } } }),
    });
    await mergeStoredSaves(services.db, await idOf(a), await idOf(b));
    expect((await getSave(services.db, await idOf(b)))?.levels).toEqual({
      meadow: { stars: 2, bestScore: 50 },
      fen: { stars: 1, bestScore: 5 },
    });
  });
});

describe('telemetry', () => {
  it('accepts game summaries', async () => {
    const res = await request('/api/telemetry', null, {
      method: 'POST',
      body: JSON.stringify({
        events: [
          {
            kind: 'game_end',
            levelId: 'meadow',
            status: 'lost',
            wave: 3,
            ticks: 900,
            livesLostPerWave: [0, 4, 16],
            towersBuilt: 2,
          },
        ],
      }),
    });
    expect(res.status).toBe(204);
  });
});
