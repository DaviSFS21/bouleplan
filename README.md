# Bouléplan

Personal planner for initiatives and tasks: a kanban of initiatives, phases and tasks, plus a weekly planner with three visual layers (fixed commitments, dedicated time and deadlines).

The name comes from the Boulé, the council of ancient Athens that prepared the agenda without deciding for anyone: the app organizes and brings clarity, and the decision stays yours.

## Repository layout

| Folder | What | Stack |
| --- | --- | --- |
| [`api/`](api/README.md) | REST backend | Java 21, Quarkus (imperative, Panache), Gradle (Kotlin DSL), Flyway |
| [`web/`](web/README.md) | Frontend | Next.js (App Router), React, TypeScript, pnpm, Vitest |
| `compose.yaml` | PostgreSQL for local development | Docker Compose |
| `.github/workflows/` | CI | GitHub Actions + SonarQube Cloud |

## Prerequisites

- Docker (with Docker Compose)
- JDK 21
- Node.js 22 and pnpm 10

## Running locally

From the repository root, start the database:

```bash
docker compose up -d
```

In one terminal, start the API in dev mode (live reload):

```bash
cd api && ./gradlew quarkusDev
```

In another terminal, start the frontend:

```bash
cd web && pnpm install && pnpm dev
```

Each project's README lists its lint, test and build commands.

## Quality and CI

Every push to `main` and every pull request runs the [`CI`](.github/workflows/ci.yml) workflow:

1. **API**: Checkstyle and PMD (any violation fails the build), tests against a real PostgreSQL, and the build.
2. **Web**: Prettier, ESLint (zero warnings), type checking, tests with coverage, and the production build.
3. **Sonar**: merges coverage from both sides and runs SonarQube Cloud. The job fails if the quality gate fails.

### One-time SonarQube Cloud setup

1. On [sonarcloud.io](https://sonarcloud.io), import the GitHub organization and the `DaviSFS21/bouleplan` repository.
2. Check that the organization and project key match [`sonar-project.properties`](sonar-project.properties) (`davisfs21` and `DaviSFS21_bouleplan`).
3. Under *Administration → Analysis Method*, turn **Automatic Analysis** off (analysis runs in CI).
4. Create a token under *My Account → Security* and add it to GitHub as an Actions secret named `SONAR_TOKEN`.

## Language

Everything in this repository (code, comments, tests, docs, commits and pull requests) is in English. User-facing UI text is in Brazilian Portuguese.

## Documentation

- Product, data model and roadmap: Notion ("bouléplan" page).
- UI: the Bouléplan Design System.
- Architecture decisions: `docs/adr/`, once they start coming up regularly.
