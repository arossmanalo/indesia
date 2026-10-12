import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health';

describe('HealthResponse', () => {
  it('accepts a valid payload', () => {
    const payload = { status: 'ok', db: 'ok', simVersion: 1, time: '2026-10-12T00:00:00.000Z' };
    expect(HealthResponse.parse(payload)).toEqual(payload);
  });

  it('rejects an unknown db status', () => {
    const payload = { status: 'ok', db: 'maybe', simVersion: 1, time: '2026-10-12T00:00:00.000Z' };
    expect(HealthResponse.safeParse(payload).success).toBe(false);
  });
});
