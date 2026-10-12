import { eq, isNull } from 'drizzle-orm';
import { SIM_VERSION } from '@indesia/sim';
import type { Db } from '../db/client';
import { seasons } from '../db/schema';

export type Season = typeof seasons.$inferSelect;

/**
 * The season for the running rules version. The first request after a rules change
 * archives the old season (its scores are kept, but leave the leaderboards) and opens
 * a new one.
 */
export async function currentSeason(db: Db, simVersion = SIM_VERSION): Promise<Season> {
  const [existing] = await db.select().from(seasons).where(eq(seasons.simVersion, simVersion));
  if (existing) return existing;
  await db.update(seasons).set({ archivedAt: new Date() }).where(isNull(seasons.archivedAt));
  await db.insert(seasons).values({ simVersion }).onConflictDoNothing();
  const [created] = await db.select().from(seasons).where(eq(seasons.simVersion, simVersion));
  return created!;
}
