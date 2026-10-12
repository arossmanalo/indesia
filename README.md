# Indesia: Tower Defense

_The last road of Indesia must hold._

Indesia is a pixel-art fantasy tower defense game you play in the browser. Build archers,
cannons, mages and frost towers along the kingdom's last road, upgrade them into
specializations, and stop armored knights, spectral wraiths and winged swarms from breaking
through.

> **Status:** in development. Playable locally: campaign map 1, guest accounts and verified leaderboards.

## Highlights (planned for v1)

- Campaign of 3 maps, 15–20 waves each, 1–3 stars per map
- 4 towers with tiered upgrades and 8 specializations; physical vs. magic damage
- Play instantly as a guest; optionally link Google or GitHub to sync progress
- Leaderboards verified by replaying every submitted game on the server
- Desktop first, playable on touch devices

## Architecture

A pnpm monorepo in strict TypeScript:

| Path              | What it is                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `packages/sim`    | Deterministic, engine-free game simulation. Runs identically in the browser and on the server. |
| `packages/shared` | Zod schemas and types for the API.                                                             |
| `apps/client`     | The game: Phaser renders the world, Preact renders menus and HUD. Built with Vite.             |
| `apps/api`        | Hono HTTP API, deployed as a single Vercel Function under `/api`.                              |

The simulation advances in fixed ticks, uses only a seeded PRNG and integer math, and changes
state only through commands. That makes every game replayable from its command log, which
powers server-verified leaderboards (and, later, lockstep multiplayer). ESLint enforces these
rules inside `packages/sim`.

Hosting: Vercel (static client + API function) with Neon Postgres, Drizzle ORM and Better Auth
(guest-first accounts, optional GitHub/Google linking). Submitted scores carry the full command
log; the server re-runs the simulation and only stores results it reproduces. Each
`SIM_VERSION` is its own leaderboard season.

## Getting started

Requires Node.js 24+ and pnpm 12 (`npm install --global pnpm@12`).

```bash
pnpm install
pnpm dev          # client on http://localhost:5173, API on http://localhost:8787/api
```

The API works without any setup: when `DATABASE_URL` is empty it runs an embedded Postgres
(PGlite) stored in `apps/api/.data`. Copy `.env.example` to `.env` to point it at a real
database or to enable GitHub/Google sign-in.

| Script              | Does                                            |
| ------------------- | ----------------------------------------------- |
| `pnpm test`         | Unit tests (Vitest)                             |
| `pnpm lint`         | ESLint                                          |
| `pnpm typecheck`    | TypeScript across all workspaces                |
| `pnpm format`       | Prettier                                        |
| `pnpm build:vercel` | Builds `.vercel/output` (client + API function) |

## License

Code is released under the [MIT License](LICENSE). Game assets keep their own licenses,
listed in `CREDITS.md`.
