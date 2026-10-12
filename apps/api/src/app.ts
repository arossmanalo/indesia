import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import {
  type ConfigResponse,
  type HealthResponse,
  type LeaderboardResponse,
  Save,
  type SubmitScoreResponse,
  TelemetryBatch,
} from '@indesia/shared';
import { getLevel, SIM_VERSION } from '@indesia/sim';
import { type Auth, type AuthEnv, createAuth, enabledProviders } from './auth';
import { connect, type Db, type DbEnv } from './db/client';
import { getSave, syncSave } from './services/saves';
import { leaderboard, submitScore } from './services/scores';
import { currentSeason } from './services/seasons';
import { recordTelemetry } from './services/telemetry';

export type Env = DbEnv & AuthEnv;

export interface Services {
  db: Db;
  auth: Auth;
  env: Env;
  simVersion: number;
}

/** Lazily connects once and shares the services across requests (and warm invocations). */
export function lazyServices(env: Env): () => Promise<Services | null> {
  let pending: Promise<Services | null> | undefined;
  return () => {
    pending ??= connect(env).then((db) =>
      db ? { db, auth: createAuth(db, env), env, simVersion: SIM_VERSION } : null,
    );
    // Retry on the next request if connecting failed.
    pending.catch(() => (pending = undefined));
    return pending;
  };
}

type Vars = { services: Services; userId: string | null };

export function createApp(getServices: () => Promise<Services | null>) {
  const app = new Hono().basePath('/api');

  app.get('/health', async (c) => {
    let db: HealthResponse['db'] = 'unconfigured';
    try {
      const services = await getServices();
      if (services) {
        await services.db.execute(sql`select 1`);
        db = 'ok';
      }
    } catch {
      db = 'error';
    }
    const body: HealthResponse = {
      status: db === 'error' ? 'degraded' : 'ok',
      db,
      simVersion: SIM_VERSION,
      time: new Date().toISOString(),
    };
    return c.json(body, db === 'error' ? 503 : 200);
  });

  // Everything below needs the database.
  const api = new Hono<{ Variables: Vars }>();
  const withServices = createMiddleware<{ Variables: Vars }>(async (c, next) => {
    let services: Services | null;
    try {
      services = await getServices();
    } catch {
      services = null;
    }
    if (!services) return c.json({ error: 'database unavailable' }, 503);
    c.set('services', services);
    const session = await services.auth.api.getSession({ headers: c.req.raw.headers });
    c.set('userId', session?.user.id ?? null);
    return next();
  });
  for (const path of ['/auth/*', '/config', '/save', '/scores', '/leaderboard/*', '/telemetry']) {
    api.use(path, withServices);
  }

  api.on(['GET', 'POST'], '/auth/*', (c) => c.var.services.auth.handler(c.req.raw));

  api.get('/config', async (c) => {
    const { env, db, simVersion } = c.var.services;
    const season = await currentSeason(db, simVersion);
    const body: ConfigResponse = { providers: enabledProviders(env), season: season.id };
    return c.json(body);
  });

  api.get('/save', async (c) => {
    const userId = c.var.userId;
    if (!userId) return c.json({ error: 'sign in required' }, 401);
    return c.json({ save: await getSave(c.var.services.db, userId) });
  });

  api.put('/save', bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
    const userId = c.var.userId;
    if (!userId) return c.json({ error: 'sign in required' }, 401);
    const parsed = Save.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'malformed save' }, 400);
    return c.json({ save: await syncSave(c.var.services.db, userId, parsed.data) });
  });

  api.post('/scores', bodyLimit({ maxSize: 512 * 1024 }), async (c) => {
    const userId = c.var.userId;
    if (!userId) return c.json({ error: 'sign in required' }, 401);
    const { db, simVersion } = c.var.services;
    const result = await submitScore(db, userId, await c.req.json().catch(() => null), simVersion);
    if (!result.ok) return c.json({ error: result.reason }, result.status);
    const body: SubmitScoreResponse = {
      score: result.score,
      stars: result.stars,
      rank: result.rank,
      season: result.season,
    };
    return c.json(body, 201);
  });

  api.get('/leaderboard/:levelId', async (c) => {
    const levelId = c.req.param('levelId');
    if (!getLevel(levelId)) return c.json({ error: 'unknown level' }, 404);
    const { db, simVersion } = c.var.services;
    const body: LeaderboardResponse = await leaderboard(db, levelId, c.var.userId, 20, simVersion);
    return c.json(body);
  });

  api.post('/telemetry', bodyLimit({ maxSize: 32 * 1024 }), async (c) => {
    const parsed = TelemetryBatch.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'malformed telemetry' }, 400);
    await recordTelemetry(c.var.services.db, c.var.userId, parsed.data);
    return c.body(null, 204);
  });

  app.route('/', api);
  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  return app;
}
