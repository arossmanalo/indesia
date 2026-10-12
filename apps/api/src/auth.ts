import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { eq } from 'drizzle-orm';
import type { Db } from './db/client';
import { schema, scores } from './db/schema';
import { mergeStoredSaves } from './services/saves';

export interface AuthEnv {
  BETTER_AUTH_SECRET?: string | undefined;
  BETTER_AUTH_URL?: string | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  GITHUB_CLIENT_ID?: string | undefined;
  GITHUB_CLIENT_SECRET?: string | undefined;
  GOOGLE_CLIENT_ID?: string | undefined;
  GOOGLE_CLIENT_SECRET?: string | undefined;
  NODE_ENV?: string | undefined;
}

const DEV_SECRET = 'indesia-local-development-secret-not-for-production';

const ADJECTIVES = ['Brave', 'Quiet', 'Swift', 'Stout', 'Keen', 'Bold', 'Grim', 'Lucky'];
const NOUNS = ['Warden', 'Archer', 'Ranger', 'Mason', 'Squire', 'Sentry', 'Herald', 'Scout'];

function guestName(): string {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]!;
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${Math.floor(1000 + Math.random() * 9000)}`;
}

export function enabledProviders(env: AuthEnv): ('github' | 'google')[] {
  const out: ('github' | 'google')[] = [];
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push('github');
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.push('google');
  return out;
}

export function createAuth(db: Db, env: AuthEnv) {
  const baseURL =
    env.BETTER_AUTH_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:5173');
  if (!env.BETTER_AUTH_SECRET && env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET must be set in production');
  }

  return betterAuth({
    baseURL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    socialProviders: {
      ...(enabledProviders(env).includes('github')
        ? { github: { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! } }
        : {}),
      ...(enabledProviders(env).includes('google')
        ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! } }
        : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 365,
      updateAge: 60 * 60 * 24 * 7,
    },
    plugins: [
      anonymous({
        generateName: guestName,
        // A guest linking GitHub/Google keeps everything: saves merge (never losing
        // progress) and verified scores move to the permanent account.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          const from = anonymousUser.user.id;
          const to = newUser.user.id;
          await mergeStoredSaves(db, from, to);
          await db.update(scores).set({ userId: to }).where(eq(scores.userId, from));
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
