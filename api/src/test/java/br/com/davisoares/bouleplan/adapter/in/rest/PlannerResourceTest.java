package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings("PMD.AvoidDuplicateLiterals") // times inline, one test per rule
class PlannerResourceTest {

  private static final String EVENTS = "events";
  private static final String ITEMS = "items";

  private String taskId;
  private String otherTaskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    String initiativeId = TaskApi.initiativeId("Study");
    taskId = TaskApi.createId(initiativeId, "Write");
    otherTaskId = TaskApi.createId(initiativeId, "Read");
  }

  @Test
  @DisplayName("an empty week has the week start and no events or items")
  void emptyWeek() {
    PlannerApi.planner(PlannerApi.MONDAY)
        .statusCode(200)
        .body("weekStart", equalTo(PlannerApi.MONDAY))
        .body(EVENTS, empty())
        .body(ITEMS, empty());
  }

  @Test
  @DisplayName("the week covers Monday to Sunday and leaves out the days around it")
  void sevenDays() {
    String sunday = "2026-11-22";
    PlannerApi.createDayListId(taskId, "2026-11-15");
    PlannerApi.createDayListId(taskId, "2026-11-23");
    String monday = PlannerApi.createDayListId(taskId, PlannerApi.MONDAY);
    String last = PlannerApi.createBlockId(taskId, sunday, "09:00", "10:00");
    PlannerApi.createEventId("Before", "2026-11-15", "09:00", "10:00");
    PlannerApi.createEventId("After", "2026-11-23", "09:00", "10:00");
    String first = PlannerApi.createEventId("First", PlannerApi.MONDAY, "09:00", "10:00");
    String end = PlannerApi.createEventId("Last", sunday, "09:00", "10:00");

    PlannerApi.planner(PlannerApi.MONDAY)
        .statusCode(200)
        .body("items.id", contains(monday, last))
        .body("events.id", contains(first, end));
  }

  @Test
  @DisplayName("items are sorted by date, then day-list order, then start time")
  void itemOrder() {
    String late = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "14:00", "15:00");
    String early = PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "08:00", "09:00");
    String second = PlannerApi.createDayListId(otherTaskId, PlannerApi.TUESDAY);
    String firstEntry = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
    PlannerApi.patchItem(firstEntry, "{\"sortOrder\": 0}").statusCode(200);
    PlannerApi.patchItem(second, "{\"sortOrder\": 1}").statusCode(200);
    String monday = PlannerApi.createBlockId(taskId, PlannerApi.MONDAY, "18:00", "19:00");

    PlannerApi.planner(PlannerApi.MONDAY)
        .body("items.id", contains(monday, firstEntry, second, early, late));
  }

  @Test
  @DisplayName("events are sorted by date and start time")
  void eventOrder() {
    String lateTuesday = PlannerApi.createEventId("C", PlannerApi.TUESDAY, "15:00", "16:00");
    String earlyTuesday = PlannerApi.createEventId("B", PlannerApi.TUESDAY, "08:00", "09:00");
    String monday = PlannerApi.createEventId("A", PlannerApi.MONDAY, "20:00", "21:00");

    PlannerApi.planner(PlannerApi.MONDAY)
        .body("events.id", contains(monday, earlyTuesday, lateTuesday));
  }

  @Test
  @DisplayName("items of hidden tasks are left out, events are not affected")
  void hiddenTasks() {
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    String visible = PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "10:00", "11:00");
    PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "10:00");
    TaskActions.archive(taskId).statusCode(200);

    PlannerApi.planner(PlannerApi.MONDAY)
        .body("items.id", contains(visible))
        .body("events.size()", equalTo(1));
  }

  @Test
  @DisplayName("a week start that is not a Monday, missing or not a date is planner.week.invalid")
  void invalidWeek() {
    for (String weekStart : new String[] {PlannerApi.TUESDAY, "2026-11-22", "nope", "2026-13-01"}) {
      InitiativeAssertions.assertProblem(
          PlannerApi.planner(weekStart), 400, "planner.week.invalid");
    }
    InitiativeAssertions.assertProblem(
        io.restassured.RestAssured.get("/planner").then(), 400, "planner.week.invalid");
    InitiativeAssertions.assertProblem(
        PlannerApi.planner("0000-12-27"), 400, "planner.week.invalid");
  }
}
