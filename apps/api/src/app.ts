import { Hono } from 'hono';
import { SIM_VERSION } from '@indesia/sim';
import type { HealthResponse } from '@indesia/shared';
import { checkDatabase } from './db';

export const app = new Hono().basePath('/api');

app.get('/health', async (c) => {
  const db = await checkDatabase(process.env.DATABASE_URL);
  const body: HealthResponse = {
    status: db === 'error' ? 'degraded' : 'ok',
    db,
    simVersion: SIM_VERSION,
    time: new Date().toISOString(),
  };
  return c.json(body, db === 'error' ? 503 : 200);
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));
