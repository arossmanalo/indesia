# Credits

Indesia's code is released under the [MIT License](LICENSE). This file lists where every
non-code asset comes from and under which license it is used.

## Art

All pixel art (terrain tiles, towers, enemies, projectiles and icons) is original to this
project. It is authored as palette-locked pixel grids in [`tools/art/sprites.ts`](tools/art/sprites.ts)
and rendered to PNG by [`tools/art/generate.ts`](tools/art/generate.ts) (`pnpm art`).
It is covered by the project's MIT License.

## Audio

All sound effects and music are synthesized at runtime with the Web Audio API in
[`apps/client/src/audio/audio.ts`](apps/client/src/audio/audio.ts). There are no audio
files. Covered by the project's MIT License.

## Fonts

| Asset         | Author            | License                                                  | Source                                                                    |
| ------------- | ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- |
| Pixelify Sans | Stefie Justprince | [SIL Open Font License 1.1](https://openfontlicense.org) | [`@fontsource/pixelify-sans`](https://fontsource.org/fonts/pixelify-sans) |

## Software

Major open-source libraries used (see each package for its full license):

| Library                                                              | License    |
| -------------------------------------------------------------------- | ---------- |
| [Phaser](https://phaser.io)                                          | MIT        |
| [Preact](https://preactjs.com)                                       | MIT        |
| [Hono](https://hono.dev)                                             | MIT        |
| [Better Auth](https://www.better-auth.com)                           | MIT        |
| [Drizzle ORM](https://orm.drizzle.team)                              | Apache-2.0 |
| [Zod](https://zod.dev)                                               | MIT        |
| [Neon serverless driver](https://github.com/neondatabase/serverless) | MIT        |
| [PGlite](https://pglite.dev) (local development only)                | Apache-2.0 |
