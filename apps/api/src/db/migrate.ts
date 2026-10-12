/**
 * Applies pending migrations to the database in DATABASE_URL (run during the Vercel build).
 * Usage: pnpm --filter @indesia/api db:migrate
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { MIGRATIONS_DIR } from './client';

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL is not set; skipping migrations.');
} else {
  await migrate(drizzle(neon(url)), { migrationsFolder: MIGRATIONS_DIR });
  console.log('Migrations applied.');
}
