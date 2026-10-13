// Runs the API and the Vite client together for local development.
// (Spawned directly with stdin ignored: under `pnpm --parallel` Vite sometimes never starts.)
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Run each tool's JavaScript entry with this Node binary (no shell: the path may contain spaces).
const entry = (pkg, file) => join(root, pkg, 'node_modules', file);

const children = [
  {
    name: 'api',
    args: [entry('apps/api', 'tsx/dist/cli.mjs'), 'watch', 'src/dev.ts'],
    cwd: join(root, 'apps/api'),
  },
  {
    name: 'client',
    args: [entry('apps/client', 'vite/bin/vite.js')],
    cwd: join(root, 'apps/client'),
  },
].map(({ name, args, cwd }) => {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `[${name}] ${line}`)
      .join('\n') + '\n';
  child.stdout.on('data', (d) => process.stdout.write(prefix(d)));
  child.stderr.on('data', (d) => process.stderr.write(prefix(d)));
  child.on('exit', (code) => {
    console.log(`[${name}] exited with ${code}`);
    shutdown(code ?? 0);
  });
  return child;
});

function shutdown(code) {
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
