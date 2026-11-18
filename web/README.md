# Bouléplan — web

Bouléplan frontend (Next.js App Router, TypeScript, pnpm).

## Requirements

- Node.js 22 or later (`.node-version`)
- pnpm 10 (exact version in `packageManager`; run `corepack enable`)

## Install

```bash
pnpm install --frozen-lockfile
```

## Development

```bash
pnpm dev
```

Opens at <http://localhost:3000>.

## Configuration

| Variable  | Default                 | What it does                                                                                                                                                               |
| --------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL` | `http://localhost:8080` | Backend base URL, read at runtime. The route handler in `src/app/api/[...path]/route.ts` proxies `/api/*` to `${API_URL}/*`, so the browser only talks to the same origin. |

## Design system

- Source of truth: `design-system/tokens.json` (Bouléplan Design System). Never edit `src/styles/tokens.css` by hand.
- `pnpm tokens` regenerates `src/styles/tokens.css` (committed); a test fails when it is stale.
- Tokens keep the design-system names as CSS custom properties: `--papel`, `--tinta`, `--space-4`, `--radius-md`, `--sombra-repouso`, `--type-titulo-pagina`... Use them in CSS Modules; never hard-code colors or sizes.
- Themes: `papel` (light) and `grafite` (dark). The system preference applies by default; `<html data-theme="papel|grafite">` forces one.
- Fonts come from `next/font/google` (Fraunces, Spectral, Work Sans) as `--font-display`, `--font-body` and `--font-ui`.
- Icons: use the `Icon` component (`@/components/icon/icon`), which fixes the Lucide stroke at 1.5 and sizes at 14, 16, 18 or 20.
- Server state: TanStack Query, provided by `Providers` in the root layout.

## API client

- `src/api/schema.d.ts` is generated from `../contract/openapi.json`; never edit it by hand. `pnpm api:types` regenerates it (committed); a test fails when it is stale.
- `src/api/client.ts` is a typed `openapi-fetch` client on `/api`. Problem responses (`application/problem+json`) become an `ApiError` carrying `detail`.
- Tests mock HTTP with `msw` (`src/test/server.ts`, started in `vitest.setup.ts`); unmocked requests fail the test.

## Screens

- `/` is the board (Quadro) and `/semana?semana=YYYY-MM-DD` the weekly planner (Semana). Both open the task panel through `?tarefa=<id>`.
- The planner drags with `@dnd-kit/core` (pointer only); the drop rules are pure functions in `src/components/planner/planner-drop.ts`.

## Checks

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `pnpm lint`          | Strict type-aware ESLint; fails on any warning                 |
| `pnpm typecheck`     | Generates Next.js types (`next typegen`), then `tsc --noEmit`  |
| `pnpm format`        | Formats the project with Prettier                              |
| `pnpm format:check`  | Checks formatting (used in CI)                                 |
| `pnpm tokens`        | Regenerates `src/styles/tokens.css` from the design tokens     |
| `pnpm api:types`     | Regenerates `src/api/schema.d.ts` from the OpenAPI contract    |
| `pnpm test`          | Runs the Vitest suite                                          |
| `pnpm test:watch`    | Runs tests in watch mode                                       |
| `pnpm test:coverage` | Runs tests with coverage (`coverage/lcov.info`, read by Sonar) |
| `pnpm build`         | Production build                                               |
| `pnpm start`         | Serves the production build                                    |

## Telemetry

Next.js telemetry is disabled by setting `NEXT_TELEMETRY_DISABLED=1` (CI already does). Locally:

```bash
export NEXT_TELEMETRY_DISABLED=1
```

## Language

All code, comments, tests and docs are in English. User-facing UI text is in Brazilian Portuguese.
