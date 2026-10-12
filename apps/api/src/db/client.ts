import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { schema } from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../drizzle', import.meta.url));

export interface DbEnv {
  DATABASE_URL?: string | undefined;
  VERCEL?: string | undefined;
  /** Directory for the local embedded database; in-memory when unset. */
  PGLITE_DIR?: string | undefined;
}

/**
 * Connects to Postgres: Neon over HTTP when DATABASE_URL is set, otherwise an embedded
 * PGlite database for local development and tests (migrated on start). Returns null on
 * Vercel without a database, so the API can report it as unconfigured.
 */
export async function connect(env: DbEnv): Promise<Db | null> {
  if (env.DATABASE_URL) {
    const { neon } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-http');
    return drizzle(neon(env.DATABASE_URL), { schema });
  }
  if (env.VERCEL) return null;

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const db = drizzle(new PGlite(env.PGLITE_DIR), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}
