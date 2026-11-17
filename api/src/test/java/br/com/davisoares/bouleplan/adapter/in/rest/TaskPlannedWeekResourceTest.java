package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskPlannedWeekResourceTest {

  private static final String WEEK = "plannedWeekStart";
  private static final String MONDAY = "2026-11-16";
  private static final String INVALID = "task.planned-week.invalid";

  private String id;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    id = TaskApi.createId(TaskApi.initiativeId("Study"), "Write");
  }

  private static String body(String date) {
    return "{\"plannedWeekStart\": " + (date == null ? "null" : "\"" + date + "\"") + "}";
  }

  private static String mondayOnOrAfter(int year) {
    return LocalDate.of(year, 1, 1)
        .with(TemporalAdjusters.nextOrSame(java.time.DayOfWeek.MONDAY))
        .toString();
  }

  @Test
  @DisplayName("a task starts unplanned")
  void startsUnplanned() {
    TaskApi.get(id).body(WEEK, nullValue());
  }

  @Test
  @DisplayName("a Monday plans the week and null clears it")
  void plansAndClears() {
    TaskApi.patch(id, body(MONDAY)).statusCode(200).body(WEEK, equalTo(MONDAY));
    TaskApi.get(id).body(WEEK, equalTo(MONDAY));

    TaskApi.patch(id, body(null)).statusCode(200).body(WEEK, nullValue());
    TaskApi.get(id).body(WEEK, nullValue());
  }

  @Test
  @DisplayName("any other weekday is refused and the old week stays")
  void notMonday() {
    TaskApi.patch(id, body(MONDAY)).statusCode(200);

    for (String date : new String[] {"2026-11-17", "2026-11-18", "2026-11-22", "2026-11-15"}) {
      InitiativeAssertions.assertProblem(TaskApi.patch(id, body(date)), 400, INVALID);
    }
    TaskApi.get(id).body(WEEK, equalTo(MONDAY));
  }

  @Test
  @DisplayName("years outside 1 to 9999 are refused, the edges are accepted")
  void yearRange() {
    InitiativeAssertions.assertProblem(TaskApi.patch(id, body(mondayOnOrAfter(0))), 400, INVALID);
    InitiativeAssertions.assertProblem(
        TaskApi.patch(id, body(mondayOnOrAfter(10_000))), 400, INVALID);

    TaskApi.patch(id, body(mondayOnOrAfter(1))).statusCode(200);
    TaskApi.patch(id, body("2024-12-30")).statusCode(200);
    TaskApi.patch(
            id,
            body(
                LocalDate.of(9999, 12, 31)
                    .with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY))
                    .toString()))
        .statusCode(200);
  }

  @Test
  @DisplayName("a mistyped or malformed week is a malformed request")
  void strictTypes() {
    for (String value :
        new String[] {"1", "true", "[]", "\"2026-13-01\"", "\"16/11/2026\"", "\"\""}) {
      InitiativeAssertions.assertMalformed(
          TaskApi.patch(id, "{\"plannedWeekStart\": " + value + "}"));
    }
  }

  @Test
  @DisplayName("a refused week rolls back the other fields of the patch")
  void atomic() {
    InitiativeAssertions.assertProblem(
        TaskApi.patch(id, "{\"title\": \"Changed\", \"plannedWeekStart\": \"2026-11-17\"}"),
        400,
        INVALID);

    TaskApi.get(id).body("title", equalTo("Write"));
  }
}
