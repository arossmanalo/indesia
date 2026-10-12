import type { TelemetryBatch } from '@indesia/shared';
import type { Db } from '../db/client';
import { telemetry } from '../db/schema';

export async function recordTelemetry(
  db: Db,
  userId: string | null,
  batch: TelemetryBatch,
): Promise<void> {
  await db
    .insert(telemetry)
    .values(batch.events.map(({ kind, ...data }) => ({ userId, kind, data })));
}
