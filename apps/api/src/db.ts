import { neon } from '@neondatabase/serverless';
import type { DbStatus } from '@indesia/shared';

export async function checkDatabase(url: string | undefined): Promise<DbStatus> {
  if (!url) return 'unconfigured';
  try {
    const sql = neon(url);
    await sql`select 1`;
    return 'ok';
  } catch {
    return 'error';
  }
}
