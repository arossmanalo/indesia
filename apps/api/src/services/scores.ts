import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getLevel, Replay, runReplay, SIM_VERSION } from '@indesia/sim';
import type { Db } from '../db/client';
import { scores, user } from '../db/schema';
import { currentSeason } from './seasons';

export type SubmitResult =
  | { ok: true; score: number; stars: number; rank: number; season: number }
  | { ok: false; status: 400 | 404 | 422; reason: string };

/** Re-runs the submitted replay and records the result only if the server agrees. */
export async function submitScore(
  db: Db,
  userId: string,
  body: unknown,
  simVersion = SIM_VERSION,
): Promise<SubmitResult> {
  const parsed = Replay.safeParse((body as { replay?: unknown } | null)?.replay);
  if (!parsed.success) return { ok: false, status: 400, reason: 'malformed replay' };
  const replay = parsed.data;
  const level = getLevel(replay.levelId);
  if (!level) return { ok: false, status: 404, reason: 'unknown level' };

  const result = runReplay(level, replay);
  if (!result.ok) return { ok: false, status: 422, reason: result.reason };
  const { outcome } = result;
  if (outcome.status !== 'won')
    return { ok: false, status: 422, reason: 'only victories are ranked' };

  const season = await currentSeason(db, simVersion);
  await db.insert(scores).values({
    userId,
    seasonId: season.id,
    levelId: level.id,
    score: outcome.score,
    stars: outcome.stars,
    lives: outcome.lives,
    ticks: outcome.tick,
    replay,
  });
  const board = await bestScores(db, season.id, level.id);
  const rank = board.findIndex((r) => r.userId === userId) + 1;
  return { ok: true, score: outcome.score, stars: outcome.stars, rank, season: season.id };
}

interface BestRow {
  userId: string;
  score: number;
  stars: number;
  createdAt: Date;
}

/** Each player's best score on a level this season, best first. */
async function bestScores(db: Db, seasonId: number, levelId: string): Promise<BestRow[]> {
  const rows = await db
    .selectDistinctOn([scores.userId], {
      userId: scores.userId,
      score: scores.score,
      stars: scores.stars,
      createdAt: scores.createdAt,
    })
    .from(scores)
    .where(and(eq(scores.seasonId, seasonId), eq(scores.levelId, levelId)))
    .orderBy(scores.userId, desc(scores.score), asc(scores.createdAt));
  return rows.sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime());
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  stars: number;
  you: boolean;
}

export async function leaderboard(
  db: Db,
  levelId: string,
  userId: string | null,
  limit = 20,
  simVersion = SIM_VERSION,
): Promise<{ season: number; entries: LeaderboardEntry[]; you: LeaderboardEntry | null }> {
  const season = await currentSeason(db, simVersion);
  const board = await bestScores(db, season.id, levelId);
  const top = board.slice(0, limit);
  const mineIndex = userId ? board.findIndex((r) => r.userId === userId) : -1;
  const ids = [...new Set([...top.map((r) => r.userId), ...(mineIndex >= 0 ? [userId!] : [])])];
  const names = new Map(
    ids.length === 0
      ? []
      : (
          await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids))
        ).map((u) => [u.id, u.name] as const),
  );
  const entry = (r: BestRow, i: number): LeaderboardEntry => ({
    rank: i + 1,
    name: names.get(r.userId) ?? 'Unknown',
    score: r.score,
    stars: r.stars,
    you: r.userId === userId,
  });
  return {
    season: season.id,
    entries: top.map(entry),
    you: mineIndex >= 0 ? entry(board[mineIndex]!, mineIndex) : null,
  };
}
