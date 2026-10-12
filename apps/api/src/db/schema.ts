import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// --- Better Auth (core tables + anonymous plugin field) ------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  isAnonymous: boolean('is_anonymous').default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// --- Game data --------------------------------------------------------------------------

/** One cloud save per player (the shared Save JSON). */
export const saves = pgTable('saves', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  updatedAt: updatedAt(),
});

/**
 * Leaderboard seasons. Every SIM_VERSION gets its own season; starting a new one
 * archives the previous (its scores stay in the database but leave the leaderboards).
 */
export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  simVersion: integer('sim_version').notNull().unique(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

/** Server-verified results: the replay was re-simulated before the row was written. */
export const scores = pgTable(
  'scores',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    levelId: text('level_id').notNull(),
    score: integer('score').notNull(),
    stars: integer('stars').notNull(),
    lives: integer('lives').notNull(),
    ticks: integer('ticks').notNull(),
    replay: jsonb('replay').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('scores_board_idx').on(t.seasonId, t.levelId, t.score),
    index('scores_user_idx').on(t.userId),
  ],
);

/** Light gameplay telemetry for balancing (no personal data beyond the user id). */
export const telemetry = pgTable(
  'telemetry',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    data: jsonb('data').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('telemetry_kind_idx').on(t.kind, t.createdAt)],
);

export const schema = { user, session, account, verification, saves, seasons, scores, telemetry };
