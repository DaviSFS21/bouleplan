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
| `PATCH` | `/initiatives/{id}` | 200; JSON merge patch (`application/merge-patch+json` or `application/json`) of `name`, `description`, `overallDeadline`, `color`: absent keeps, `null` clears; active only, else 404 |
| `POST` | `/initiatives/{id}/archive` | 200; active only, else 404 |
| `POST` | `/initiatives/{id}/unarchive` | 200; archived (or already active: no-op), else 404 |
| `DELETE` | `/initiatives/{id}` | 204 (soft delete); active only, else 404 |
| `POST` | `/initiatives/{id}/restore` | 200; deleted (or not deleted: no-op), else 404 |

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/initiatives/{id}/phases` | 200, active named phases in creation order; 404 if the initiative is not active and the user's |
| `POST` | `/initiatives/{id}/phases` | 201 with `Location: /phases/{id}`; body `{"name": "..."}`; 404 as above |
| `GET` | `/phases/{id}` | 200 if the phase is named, active and in an active initiative of the user, else 404 |
| `PATCH` | `/phases/{id}` | 200; merge patch of `name`; active phase only, else 404 |
| `POST` | `/phases/{id}/archive` | 200; active phase only, else 404 |
| `POST` | `/phases/{id}/unarchive` | 200; archived (or already active: no-op), else 404 |
| `DELETE` | `/phases/{id}` | 204 (soft delete); active phase only, else 404 |
| `POST` | `/phases/{id}/restore` | 200; deleted (or not deleted: no-op, so an archived phase stays archived while the body looks active), else 404 |

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/tasks` | 200, active tasks whose phase and initiative are active, by priority (P1 first), deadline (none last), creation, id |
| `POST` | `/initiatives/{id}/tasks` | 201 with `Location: /tasks/{id}`; body `{"title": "...", "phaseId": "uuid" (optional, null = implicit), "status": "to_do" (optional)}`; 404 if the initiative is not active and the user's, or `phaseId` is not an active named phase of it |
| `GET` | `/tasks/{id}` | 200 if the task, its phase and its initiative are active and the user's, else 404 |
| `PATCH` | `/tasks/{id}` | 200; merge patch of `title`, `description`, `deadline`, `estimatedEffort`, `priority`, `status`, `isBlocked`, `phaseId`, `plannedWeekStart`: absent keeps, `null` clears `description`, `deadline`, `estimatedEffort` and `plannedWeekStart`, and moves the task to the implicit phase for `phaseId`; `null` on the others is 400 `http.400`; `phaseId` must be an active named phase of the task's initiative, else 404; `plannedWeekStart` must be a Monday; active task only, else 404 |
| `POST` | `/tasks/{id}/archive` | 200; active task only, else 404 |
| `POST` | `/tasks/{id}/unarchive` | 200; archived (or already active: no-op), else 404 |
| `DELETE` | `/tasks/{id}` | 204 (soft delete); active task only, else 404 |
| `POST` | `/tasks/{id}/restore` | 200; deleted (or not deleted: no-op), else 404 |
| `PUT` | `/tasks/{blockingId}/blocks/{blockedId}` | 204, idempotent; 404 unless both tasks are active in an active phase and initiative of the user; 422 `task.blocker.self` or `task.blocker.cycle` |
| `DELETE` | `/tasks/{blockingId}/blocks/{blockedId}` | 204, idempotent (also when there is no link); 404 unless both tasks are reachable |

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/planner?weekStart=YYYY-MM-DD` | 200 `{weekStart, events, items}` for the 7 days from a Monday; items of visible tasks sorted by date, day-list order, then start; 400 `planner.week.invalid` if `weekStart` is missing, not a date or not a Monday |
| `POST` | `/calendar-events` | 201 with `Location: /calendar-events/{id}`; body `{title, date, startTime, endTime}` |
| `PATCH` | `/calendar-events/{id}` | 200; merge patch of the same fields (none can be `null`); 404 if it is not the user's |
| `DELETE` | `/calendar-events/{id}` | 204 (physical delete); 404 as above |
| `POST` | `/scheduled-items` | 201 with `Location: /scheduled-items/{id}`; `{taskId, date}` adds the task to the day list (`sortOrder` = highest of the user's day + 1, 0 first), `{taskId, date, startTime, endTime}` creates a dedicated block; 404 unless the task is active in an active phase and initiative of the user; 422 `scheduled-item.task-done`; 409 `scheduled-item.duplicate` or `scheduled-item.overlap` |
| `PATCH` | `/scheduled-items/{id}` | 200; merge patch of `date`, `startTime`, `endTime`, `sortOrder` (see below); same 404, 422 and 409 |
| `DELETE` | `/scheduled-items/{id}` | 204 (physical delete); 404 unless its task is reachable |
| `GET` | `/tasks/{id}/scheduled-items` | 200, the task's dedicated blocks on any date by date and start; 404 if the task is not reachable |

Times are `HH:mm` quarter hours from `00:00` to `23:45`, the start before the end on the same day
(`24:00` is a malformed request). Fixed events may overlap anything. Dedicated blocks of the user
cannot overlap on a date (`[start, end)`, so touching blocks are fine): 409 `scheduled-item.overlap`.
Only blocks of visible tasks count. A day-list entry has an order and no times, a block has both
times and no order. `PATCH` merges the sent fields into the item and the result decides its kind:
both times `null` is a day-list entry, both set is a block, one set is `scheduled-item.time.invalid`.
The no-overlap rule applies to planner writes (create, move, resize, entry to block), not to
restores: bringing a hidden task back restores its blocks as they were, even over newer ones, and a
later write into the shared time is refused while the other block is visible. A day-list entry
keeps its `sortOrder` on the same day, and is appended when it changes day, comes
from a block, or sends `sortOrder: null`; a number sets the order, and if another entry of the user has it, entries move by one: a reorder in the same day shifts those between the old and the new place (so moving back restores the list), an entry coming from elsewhere pushes those from that order upwards. A block
cannot have a `sortOrder`. Items of a task that is archived, deleted, or in an archived or deleted
phase or initiative are hidden, answer 404 and come back with it; an item of a task that is `done`
cannot be created or changed (422), but can be deleted.

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/introspections/{weekStart}` | 200 `{weekStart, answers: [{key, prompt, answer}], closedAt, updatedAt}`: the stored sheet, or an unsaved empty draft (`updatedAt` null) when there is none, never 404; 400 `introspection.week.invalid` unless `weekStart` is a Monday with a year from 1 to 9999 |
| `PUT` | `/introspections/{weekStart}` | 200; body `{"answers": [{"key", "answer"}]}` with the keys `went_well`, `went_badly`, `to_improve` at most once each; upserts the draft, keys not sent keep their answer and every stored prompt stays; answers are plain text of at most 10000 characters (CRLF/CR become LF); an unknown or duplicate key, extra fields or wrong types are 400 `http.400`; 400 `introspection.answer.too-long` or `introspection.answer.invalid-characters`; 409 `introspection.closed` |
| `POST` | `/introspections/{weekStart}/close` | 200, stamps `closedAt` (creating an empty sheet if there is none); 409 `introspection.closed` if already closed; 422 `introspection.week.future` if the week starts after the current week (UTC) |

A closed sheet is read-only. The server owns the question texts and stores each prompt with its answer when the sheet is created.

Every task JSON has `reservedMinutes` (the minutes of the task's visible dedicated blocks) and
`reservedByDeadlineMinutes` (the same, only blocks dated on or before the `deadline`; equal to
`reservedMinutes` when there is no deadline). The task list gets both with one grouped query.

A task without `phaseId` goes to the initiative's implicit phase, created on demand and reused, even
when the initiative has named phases; the task JSON shows it as `phaseId: null`. Every task JSON has `blocks` and
`blockedBy`: the ids of the visible tasks it blocks and that block it, in the order of `GET /tasks`.
Links to hidden tasks (archived, deleted, or in an archived or deleted phase or initiative) stay
stored and reappear with them, and they still count when checking for cycles. A task answers 404
whenever its phase or initiative is archived, deleted or not the user's; its own state is untouched
and it returns with them.

Implicit phases are never exposed. A phase answers 404 whenever its initiative is archived, deleted
or not the user's; its own state is untouched and it returns with the initiative.

Create and patch bodies are strict: unknown fields, mistyped values, unknown enum values, malformed
dates and duplicate keys are 400 `http.400`.

Errors are RFC 9457 `application/problem+json` with `type`, `title`, `status`, `detail` and `code`.
Clients show their own (pt-BR) text chosen by `code`, never `detail`.

| `type` | Status | `code` |
| --- | --- | --- |
| `/problems/rule-violation` | 400 | the domain rule: `initiative.name.blank`, `initiative.name.too-long`, `initiative.name.invalid-characters`, `initiative.description.too-long`, `initiative.description.invalid-characters`, `initiative.deadline.invalid`, `initiative.color.required`, `initiative.color.invalid`, `phase.name.blank`, `phase.name.too-long`, `phase.name.invalid-characters`, `task.title.blank`, `task.title.too-long`, `task.title.invalid-characters`, `task.description.too-long`, `task.description.invalid-characters`, `task.deadline.invalid`, `task.effort.invalid`, `task.planned-week.invalid`, `calendar-event.title.blank`, `calendar-event.title.too-long`, `calendar-event.title.invalid-characters`, `calendar-event.time.invalid`, `scheduled-item.time.invalid`, `planner.week.invalid`, `introspection.week.invalid`, `introspection.answer.too-long`, `introspection.answer.invalid-characters` |
| `/problems/rule-violation` | 409 | `scheduled-item.overlap`, `scheduled-item.duplicate`, `introspection.closed` |
| `/problems/rule-violation` | 422 | `task.blocker.self`, `task.blocker.cycle`, `scheduled-item.task-done`, `introspection.week.future` |
| `/problems/malformed-request` | 400 | `http.400` |
| `/problems/http-error` | framework status (404, 405, 415...) | `http.<status>` |
| `/problems/internal` | 500 | `internal` (message logged, never returned) |

Descriptions normalize `\r\n` and a lone `\r` to `\n`; other control characters except `\t` are rejected.
Deadlines must have a year from 1 to 9999.

Writes to one initiative (update, archive, unarchive, delete, restore) load it with
`select ... for update`, so concurrent writes are serialized and none is lost.

Lock order: user, then initiative, then phase, then task (item and event writes: user first, then
the task chain). Phase writes lock the owning initiative
row first; task writes lock the initiative, the phase and the task (parent ids are read without
loading the child, and the task's phase is read again once the initiative is locked, because a move
changes it). A task create locks the initiative, which serializes the creation of the implicit phase.
A phase move locks the current and the target phase by id order, so opposite moves cannot deadlock.

Blocker writes lock the user's `app_user` row first, so the cycle check and the insert of two
concurrent writes never interleave (they may touch tasks of unrelated initiatives), and then both
tasks by id order. A link is refused with 422 `task.blocker.cycle` when the blocked task already
reaches the blocking one through stored links (a recursive query that includes hidden tasks).

Writes to `scheduled_item` and `calendar_event` (all of them, events included) lock the user's
`app_user` row first, so the overlap and duplicate checks and the order of two concurrent writes
never interleave, even for tasks of unrelated initiatives. A write to an item then takes the
initiative, phase and task locks of its task, in the order above, and the item row itself is only
read: every item write holds the user lock.

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
