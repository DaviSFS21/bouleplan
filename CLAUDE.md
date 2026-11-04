# Bouléplan — agent instructions

Personal monorepo: `api/` (Quarkus) and `web/` (Next.js). Read the root `README.md` and the README of the project you are changing.

## Way of working
- Work in steps and stop for review at the end of each one; explain the reasoning behind decisions. When there is more than one reasonable path, present the options with pros and cons before choosing.
- Each roadmap step gets its own branch and pull request. Branches are named `step-N/topic` in English kebab-case (for example `step-1/foundation`, `step-2/create-initiatives`). Choose the name before the first push: renaming a branch on GitHub by deleting it closes its open pull request.
- **Vertical slices**: one feature end to end (domain → API → screen) at a time.
- **TDD**: write the test before the code.

## Language
- **Everything in the repository is in English**: identifiers, comments, Javadoc/TSDoc, test names, config and CI comments, READMEs, ADRs, commit messages and pull request descriptions.
- The only exception is **user-facing UI text**, which is in Brazilian Portuguese (`pt-BR`).
- Table and column names follow the ERD (`initiative`, `phase`, `task`, `scheduled_item`…).

## Backend (`api/`)
- Java 21, imperative Quarkus (never reactive), Panache, PostgreSQL, Flyway (Flyway owns the schema; Hibernate never generates tables).
- Relaxed hexagonal architecture: the JPA/Panache entity carries the business rules (no duplicated domain class, no mapper); the separation lives in the ports (`application.port.in`/`out`) and adapters (`adapter.in.rest`, `adapter.out.persistence`). `domain` never depends on `adapter`.
- Strict Checkstyle (Google Java Style) and PMD: any violation fails the build. Never disable a rule without a justification in the config file itself.
- `./gradlew check` must pass before any commit. Tests start PostgreSQL through Dev Services (requires Docker).

## Frontend (`web/`)
- Next.js App Router, strict TypeScript, pnpm, Vitest + Testing Library.
- ESLint with `--max-warnings=0` and Prettier. Before committing: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- The UI follows the Bouléplan Design System: always use its tokens, never hard-coded colors or sizes.

## Data model (MVP)
ERD tables: `user`, `initiative`, `phase`, `task`, `task_blocker`, `scheduled_item`, `calendar_event`. The ERD and modeling decisions live in Notion ("Técnico & Roadmap" page), which is the source of truth. The points most likely to cause mistakes:
- Every task points to a `phase`; an initiative without named phases gets an implicit phase (`is_implicit = true`), which the UI hides.
- `is_blocked` is the task's own situation, independent of `status` (`to_do`, `in_progress`, `done`) and of `task_blocker`.
- Archive and delete are reversible (`archived_at`, `deleted_at`); only the item acted on gets the timestamp.
- `initiative.color` stores the token name, never the hex value.
