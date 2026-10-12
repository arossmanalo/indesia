// Builds the Vercel Build Output API layout (.vercel/output):
//   static/          the Vite client build
//   functions/api.func  the Hono API bundled into a single Node.js function
// https://vercel.com/docs/build-output-api
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.vercel', 'output');
const funcDir = join(out, 'functions', 'api.func');

function pnpm(...args) {
  // Reuse the pnpm that launched this script (it may not be on PATH, e.g. under npx).
  const execPath = process.env.npm_execpath;
  const result = /\.c?js$/.test(execPath ?? '')
    ? spawnSync(process.execPath, [execPath, ...args], { cwd: root, stdio: 'inherit' })
    : spawnSync(`pnpm ${args.join(' ')}`, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(out, { recursive: true, force: true });

// Apply database migrations when a database is configured (Vercel injects DATABASE_URL).
if (process.env.DATABASE_URL) pnpm('--filter', '@indesia/api', 'db:migrate');

pnpm('--filter', '@indesia/client', 'build');
cpSync(join(root, 'apps', 'client', 'dist'), join(out, 'static'), { recursive: true });

mkdirSync(funcDir, { recursive: true });
await build({
  entryPoints: [join(root, 'apps', 'api', 'src', 'vercel.ts')],
  outfile: join(funcDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  // The embedded database is for local development only.
  external: ['@electric-sql/pglite', 'drizzle-orm/pglite', 'drizzle-orm/pglite/*'],
  // Some CommonJS dependencies call require(); give the ESM bundle one.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
writeFileSync(
  join(funcDir, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs24.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
);

writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        { src: '^/assets/.*$', status: 404 },
        { src: '^/.*$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log(`Vercel build output written to ${out}`);
