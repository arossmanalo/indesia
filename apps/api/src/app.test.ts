import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthResponse } from '@indesia/shared';
import { SIM_VERSION } from '@indesia/sim';
import { app } from './app';

describe('GET /api/health', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports ok with an unconfigured database', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = HealthResponse.parse(await res.json());
    expect(body).toMatchObject({ status: 'ok', db: 'unconfigured', simVersion: SIM_VERSION });
  });

  it('reports degraded when the database is unreachable', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@127.0.0.1:1/none');
    const res = await app.request('/api/health');
    expect(res.status).toBe(503);
    expect(HealthResponse.parse(await res.json()).db).toBe('error');
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });
});
