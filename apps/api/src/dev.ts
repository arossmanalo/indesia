import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp, lazyServices } from './app';

try {
  process.loadEnvFile('../../.env');
} catch {
  // No local .env: use the embedded database.
}

// Without DATABASE_URL, keep local data in an embedded Postgres under apps/api/.data.
const pgliteDir = resolve('.data/pglite');
if (!process.env.DATABASE_URL) mkdirSync(pgliteDir, { recursive: true });

const app = createApp(lazyServices({ ...process.env, PGLITE_DIR: pgliteDir }));
const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`);
});
