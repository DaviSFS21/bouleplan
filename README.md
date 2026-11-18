# Bouléplan

Personal planner for initiatives and tasks: a kanban of initiatives, phases and tasks, plus a weekly planner with three visual layers (fixed commitments, dedicated time and deadlines).

The name comes from the Boulé, the council of ancient Athens that prepared the agenda without deciding for anyone: the app organizes and brings clarity, and the decision stays yours.

## Repository layout

| Folder | What | Stack |
| --- | --- | --- |
| [`api/`](api/README.md) | REST backend | Java 21, Quarkus (imperative, Panache), Gradle (Kotlin DSL), Flyway |
| [`web/`](web/README.md) | Frontend | Next.js (App Router), React, TypeScript, pnpm, Vitest |
| `compose.yaml` | PostgreSQL for local development; with `--profile dev`, the API and the web app too | Docker Compose |
| `compose.prod.yaml` | Single-host deployment: PostgreSQL, the API and the web app from their production images | Docker Compose |
| `docker/` | Development image of the web app | Docker |
| `.github/workflows/` | CI | GitHub Actions + SonarQube Cloud |

## Prerequisites

- Docker (with Docker Compose)
- JDK 21, and Node.js 22 with pnpm 10, unless you run everything in Docker (see below)

## Running locally

From the repository root, create your local `.env` once, then set `DB_PASSWORD` in it (it ships empty, and Docker Compose refuses to start without it). It is git-ignored and holds the database credentials used by both Docker Compose and the API in dev mode:

```bash
cp .env.example .env
```

If a PostgreSQL installed on your machine already uses port 5432, set `DB_PORT` in `.env` to a free port, such as `5433`. Otherwise the API connects to that server instead of the container and fails with a password authentication error.

Start the database:

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

### Everything in Docker

To run the database, the API and the frontend without installing a JDK, Node.js or pnpm, use the `dev` profile. Create `.env` as above, then:

```bash
docker compose --profile dev up
```

- The frontend is at http://localhost:3000 and the API at http://localhost:8080. Change `WEB_PORT` or `API_PORT` in `.env` if those ports are taken.
- `api/` and `web/` are mounted into the containers, so edits reload live: the API recompiles on the next request and the frontend hot-reloads.
- The first start takes a few minutes while Gradle and pnpm download dependencies. They are kept in Docker volumes, so later starts are quick.
- The web container runs as the owner of `web/`, so the files it writes there belong to you. On Linux, run `pnpm install` on the host once before the first start, so `web/node_modules` is not created by Docker.
- PostgreSQL applies `DB_PASSWORD` only when its volume is first created. To change the password later, remove the volume with `docker compose down -v`, which deletes the local data.

Plain `docker compose up -d` still starts only the database.

## End-to-end tests

Playwright tests in [`web/e2e/`](web/e2e) drive the real UI against the real API and PostgreSQL. They start no servers and **delete every initiative (and everything under it) before each test**, so point them only at a disposable database.

1. Start the database, the API and the frontend as in [Running locally](#running-locally).
2. Install the browser once: `cd web && pnpm exec playwright install chromium`.
3. Run the tests:

```bash
cd web
E2E_DATABASE_URL=postgresql://<DB_USERNAME>:<DB_PASSWORD>@localhost:<DB_PORT>/<DB_NAME> pnpm e2e
```

| Variable           | Default                 | What it does                                                      |
| ------------------ | ----------------------- | ----------------------------------------------------------------- |
| `E2E_DATABASE_URL` | none (required)         | Database the tests reset; use the values from your `.env`         |
| `E2E_BASE_URL`     | `http://localhost:3000` | Where the frontend is served                                      |
| `PW_CHROMIUM_PATH` | Playwright's own        | Chromium executable to use instead of the one Playwright installs |

CI runs the same tests in the `e2e` job, against the production images started with `compose.prod.yaml`.

## Deploying

`compose.prod.yaml` runs PostgreSQL, the API and the web app on a single host, from images built out of `api/Dockerfile` and `web/Dockerfile`. Only the web port is published; the API and the database stay on the internal network.

1. Copy `.env.example` to `.env` and fill it in. Set a strong `DB_PASSWORD` (the compose file refuses an empty one), and set `WEB_PORT` if 3000 is taken.
2. Build and start everything:

   ```bash
   docker compose -f compose.prod.yaml up -d --build
   ```

3. Open the app at `http://<host>:<WEB_PORT>`. The API applies the database migrations when it starts, and the web container waits for the API to be healthy.
4. To update, run `git pull` and the same command again. Data lives in the `db-data` volume and survives rebuilds.
5. Back up the database:

   ```bash
   docker compose -f compose.prod.yaml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > bouleplan.sql
   ```

6. Restore. The API migrates the database on start, so it is never empty while the API runs: stop the app, recreate the database, load the dump, then start again.

   ```bash
   docker compose -f compose.prod.yaml stop api web
   docker compose -f compose.prod.yaml exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
   docker compose -f compose.prod.yaml exec -T db sh -c 'psql -U "$POSTGRES_USER" -v ON_ERROR_STOP=1 --single-transaction "$POSTGRES_DB"' < bouleplan.sql
   docker compose -f compose.prod.yaml up -d
   ```

The web container reads `API_URL` (set to `http://api:8080` in the compose file) when it starts, so pointing it at another API needs a restart, not a rebuild. To use published images instead of building, set `API_IMAGE` and `WEB_IMAGE` in `.env` and run `docker compose -f compose.prod.yaml pull` and `up -d`.

**There is no authentication yet.** Do not expose the app to the internet without something in front of it, such as a VPN or a reverse proxy with authentication.

## Quality and CI

Every push to `main` and every pull request runs the [`CI`](.github/workflows/ci.yml) workflow:

1. **API**: Checkstyle and PMD (any violation fails the build), tests against a real PostgreSQL, and the build.
2. **Web**: Prettier, ESLint (zero warnings), type checking, tests with coverage, and the production build.
3. **E2E**: builds both production images, starts them with PostgreSQL through `compose.prod.yaml` (plus `compose.ci.yaml`, which publishes the database port for the test reset), and runs the Playwright tests against the web container.
4. **Sonar**: merges coverage from both sides and runs SonarQube Cloud. The job fails if the quality gate fails.

### One-time SonarQube Cloud setup

1. On [sonarcloud.io](https://sonarcloud.io), import the GitHub organization and the `DaviSFS21/bouleplan` repository.
2. Check that the organization and project key match [`sonar-project.properties`](sonar-project.properties) (`davisfs21` and `DaviSFS21_bouleplan`).
3. Under *Administration → Analysis Method*, turn **Automatic Analysis** off (analysis runs in CI).
4. Create a token under *My Account → Security* and add it to GitHub as an Actions secret named `SONAR_TOKEN`.
5. Add the same token as a **Dependabot** secret named `SONAR_TOKEN` (*Settings → Secrets and variables → Dependabot*). Dependabot pull requests do not receive Actions secrets, so without it their `sonar` job fails.

### Dependency updates

[Dependabot](.github/dependabot.yml) opens grouped pull requests every Monday for Gradle (`api/`), pnpm (`web/`), GitHub Actions and the base images of both Dockerfiles. Java 21 and Node 22 stay put: Dependabot ignores major versions of `eclipse-temurin` and `node`. A version is only proposed after it has been public for 14 days. Quarkus stays on its LTS line: Dependabot only proposes patch releases within it, and moving to a new LTS is a deliberate upgrade.

## Language

Everything in this repository (code, comments, tests, docs, commits and pull requests) is in English. User-facing UI text is in Brazilian Portuguese.

## Documentation

- Product, data model and roadmap: Notion ("bouléplan" page).
- UI: the Bouléplan Design System.
- Architecture decisions: `docs/adr/`, once they start coming up regularly.
