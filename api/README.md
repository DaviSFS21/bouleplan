# Bouléplan API

Quarkus backend (Java 21, Gradle Kotlin DSL) with a relaxed hexagonal architecture.

## Running in development

Start Postgres from the `compose.yaml` at the repository root, then start Quarkus:

```bash
docker compose up -d db   # from the repository root
./gradlew quarkusDev
```

The `dev` profile connects to `localhost:5432` (database/user/password: `bouleplan`).

## Verification

```bash
./gradlew check   # Checkstyle + PMD + tests + JaCoCo report
```

Tests use Dev Services (Testcontainers) with `postgres:17-alpine`; Docker must be running.

## Reports

- Checkstyle: `build/reports/checkstyle/`
- PMD: `build/reports/pmd/`
- Tests: `build/reports/tests/test/`
- JaCoCo XML (SonarQube), merging unit and `@QuarkusTest` coverage: `build/jacoco-report/jacoco.xml`
- Compiled classes (`sonar.java.binaries`): `build/classes/java/main`

## Production

Required environment variables: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`.
