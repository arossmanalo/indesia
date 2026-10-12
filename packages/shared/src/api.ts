import { z } from 'zod';

export const ConfigResponse = z.object({
  providers: z.array(z.enum(['github', 'google'])),
  season: z.number().int().nullable(),
});
export type ConfigResponse = z.infer<typeof ConfigResponse>;

export const SubmitScoreResponse = z.object({
  score: z.number().int(),
  stars: z.number().int(),
  rank: z.number().int(),
  season: z.number().int(),
});
export type SubmitScoreResponse = z.infer<typeof SubmitScoreResponse>;

export const LeaderboardEntry = z.object({
  rank: z.number().int(),
  name: z.string(),
  score: z.number().int(),
  stars: z.number().int(),
  you: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const LeaderboardResponse = z.object({
  season: z.number().int(),
  entries: z.array(LeaderboardEntry),
  you: LeaderboardEntry.nullable(),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;

export const GameEndEvent = z.object({
  kind: z.literal('game_end'),
  levelId: z.string().max(64),
  status: z.enum(['won', 'lost', 'quit']),
  wave: z.number().int().nonnegative(),
  ticks: z.number().int().nonnegative(),
  livesLostPerWave: z.array(z.number().int().nonnegative()).max(100),
  towersBuilt: z.number().int().nonnegative(),
});

export const TelemetryBatch = z.object({
  events: z.array(GameEndEvent).min(1).max(20),
});
export type TelemetryBatch = z.infer<typeof TelemetryBatch>;
export type GameEndEvent = z.infer<typeof GameEndEvent>;
