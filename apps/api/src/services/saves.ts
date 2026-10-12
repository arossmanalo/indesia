import { eq } from 'drizzle-orm';
import { mergeSaves, Save } from '@indesia/shared';
import type { Db } from '../db/client';
import { saves } from '../db/schema';

export async function getSave(db: Db, userId: string): Promise<Save | null> {
  const [row] = await db.select().from(saves).where(eq(saves.userId, userId));
  if (!row) return null;
  const parsed = Save.safeParse(row.data);
  return parsed.success ? parsed.data : null;
}

async function writeSave(db: Db, userId: string, data: Save): Promise<void> {
  await db
    .insert(saves)
    .values({ userId, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: saves.userId, set: { data, updatedAt: new Date() } });
}

/** Merges an incoming save into the stored one (progress is never lost) and returns it. */
export async function syncSave(db: Db, userId: string, incoming: Save): Promise<Save> {
  const current = await getSave(db, userId);
  const merged = current ? mergeSaves(current, incoming) : incoming;
  await writeSave(db, userId, merged);
  return merged;
}

/** Folds one player's save into another's (used when a guest links an account). */
export async function mergeStoredSaves(
  db: Db,
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  const from = await getSave(db, fromUserId);
  if (!from) return;
  await syncSave(db, toUserId, from);
}
