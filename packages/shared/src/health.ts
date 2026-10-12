import { z } from 'zod';

export const DbStatus = z.enum(['ok', 'unconfigured', 'error']);
export type DbStatus = z.infer<typeof DbStatus>;

export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  db: DbStatus,
  simVersion: z.number().int().positive(),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
