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

## Checks

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `pnpm lint`          | Strict type-aware ESLint; fails on any warning                 |
| `pnpm typecheck`     | Generates Next.js types (`next typegen`), then `tsc --noEmit`  |
| `pnpm format`        | Formats the project with Prettier                              |
| `pnpm format:check`  | Checks formatting (used in CI)                                 |
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
