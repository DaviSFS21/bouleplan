# Bouléplan API

Quarkus backend (Java 21, Gradle Kotlin DSL) with a relaxed hexagonal architecture.

## Running in development

Start Postgres from the `compose.yaml` at the repository root, then start Quarkus:

```bash
docker compose up -d db   # from the repository root
./gradlew quarkusDev
```

The `dev` profile connects to the PostgreSQL from the root `compose.yaml` on `localhost:5432`. Credentials (`DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`) come from the root `.env` file (copy `.env.example`), which `build.gradle.kts` passes to `quarkusDev`.

## Verification

```bash
./gradlew check   # Spotless + Checkstyle + PMD + tests (incl. ArchUnit) + JaCoCo report
```

Tests use Dev Services (Testcontainers) with `postgres:17-alpine`; Docker must be running.

## Formatting

Java code is formatted with google-java-format through Spotless. `check` runs `spotlessCheck`, so
unformatted code fails the build. Fix it with:

```bash
./gradlew spotlessApply
```

## Architecture rules

`ArchitectureTest` (ArchUnit, plain JUnit 5, runs in `./gradlew test`) enforces the relaxed
hexagonal architecture on the production classes:

1. `domain` does not depend on `application` or `adapter`.
2. `application` does not depend on `adapter`.
3. Inbound adapters (`adapter.in`) and outbound adapters (`adapter.out`) do not depend on each other.
4. Inbound adapters use only inbound ports: no dependency on `application.service` or
   `application.port.out`.
5. `domain` does not depend on REST/HTTP APIs (`jakarta.ws.rs`, `io.quarkus.rest`,
   `org.jboss.resteasy`). JPA and Panache are allowed, because entities carry the business rules.
6. No dependency cycles between the top-level slices `domain`, `application` and `adapter`.

## REST API

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/initiatives` | 200, active initiatives in creation order |
| `POST` | `/initiatives` | 201 with `Location: /initiatives/{id}`; body `{"name": "..."}` |
| `GET` | `/initiatives/{id}` | 200 if the initiative is active and the current user's, else 404 |

Errors are RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail` and `code`.
Clients show their own (pt-BR) text chosen by `code`, never `detail`.

| `type` | Status | `code` |
| --- | --- | --- |
| `/problems/rule-violation` | 400 | the domain rule: `initiative.name.blank`, `initiative.name.too-long`, `initiative.name.invalid-characters` |
| `/problems/malformed-request` | 400 | `http.400` |
| `/problems/http-error` | framework status (404, 405, 415...) | `http.<status>` |
| `/problems/internal` | 500 | `internal` (message logged, never returned) |

Concurrent creates are serialized per user: the use case locks the user's `app_user` row
(`select ... for update`) before choosing a color.

## API contract

The OpenAPI schema is committed at `contract/openapi.json` (repository root) and is the source for
the frontend client. The build generates it with `quarkus-smallrye-openapi`.

```bash
./gradlew checkContract    # fails if contract/openapi.json differs from the code (part of check)
./gradlew updateContract   # rewrites contract/openapi.json; commit the result
```

## Dependency versions

All versions live in `gradle/libs.versions.toml` (read by Dependabot). The Checkstyle, PMD, JaCoCo
and google-java-format entries are declared as libraries only so that Dependabot tracks them; the
build reads their versions to configure the Gradle plugins.

## Reports

- Checkstyle: `build/reports/checkstyle/`
- PMD: `build/reports/pmd/`
- Tests: `build/reports/tests/test/`
- JaCoCo XML (SonarQube), merging unit and `@QuarkusTest` coverage: `build/jacoco-report/jacoco.xml`
- Compiled classes (`sonar.java.binaries`): `build/classes/java/main`

## Production

Required environment variables: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`.
