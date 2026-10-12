import { serve } from '@hono/node-server';
import { app } from './app';

try {
  process.loadEnvFile('../../.env');
} catch {
  // No local .env: the API runs with the database unconfigured.
}

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`);
});
