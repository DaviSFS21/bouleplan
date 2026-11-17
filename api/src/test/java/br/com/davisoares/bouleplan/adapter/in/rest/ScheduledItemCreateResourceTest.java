package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings({
  "PMD.TooManyMethods",
  "PMD.AvoidDuplicateLiterals"
}) // one test per rule, times inline
class ScheduledItemCreateResourceTest {

  private static final String START = "startTime";
  private static final String SORT_ORDER = "sortOrder";

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String taskId;
  private String otherTaskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    taskId = TaskApi.createId(initiativeId, "Write");
    otherTaskId = TaskApi.createId(initiativeId, "Read");
  }

  @Test
  @DisplayName("POST without times adds the task to the day list, appending the order")
  void dayList() {
    PlannerApi.postItem(PlannerApi.dayListJson(taskId, PlannerApi.TUESDAY))
        .statusCode(201)
        .header("Location", containsString("/scheduled-items/"))
        .body("taskId", equalTo(taskId))
        .body("date", equalTo(PlannerApi.TUESDAY))
        .body(START, nullValue())
        .body("endTime", nullValue())
        .body(SORT_ORDER, equalTo(0));
    PlannerApi.postItem(PlannerApi.dayListJson(otherTaskId, PlannerApi.TUESDAY))
        .statusCode(201)
        .body(SORT_ORDER, equalTo(1));
    PlannerApi.postItem(PlannerApi.dayListJson(otherTaskId, PlannerApi.WEDNESDAY))
        .statusCode(201)
        .body(SORT_ORDER, equalTo(0));
  }

  @Test
  @DisplayName("POST with both times creates a block with HH:mm times and no order")
  void block() {
    PlannerApi.postItem(PlannerApi.blockJson(taskId, PlannerApi.TUESDAY, "09:00", "10:30"))
        .statusCode(201)
        .body(START, equalTo("09:00"))
        .body("endTime", equalTo("10:30"))
        .body(SORT_ORDER, nullValue())
        .body("createdAt", notNullValue());
  }

  @Test
  @DisplayName("a task can have a day-list entry and several blocks on the same day")
  void sameTaskManyItems() {
    PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "10:00", "11:00");
    PlannerApi.createBlockId(taskId, PlannerApi.WEDNESDAY, "09:00", "10:00");
  }

  @Test
  @DisplayName("block times must be quarter hours with the start before the end, both given")
  void timeRules() {
    for (String[] times :
        new String[][] {
          {"09:10", "10:00"}, {"09:00", "10:05"}, {"10:00", "10:00"}, {"11:00", "10:00"}
        }) {
      InitiativeAssertions.assertProblem(
          PlannerApi.postItem(PlannerApi.blockJson(taskId, PlannerApi.TUESDAY, times[0], times[1])),
          400,
          PlannerApi.ITEM_TIME);
    }
    InitiativeAssertions.assertProblem(
        PlannerApi.postItem(
            "{\"taskId\": \"%s\", \"date\": \"2026-11-17\", \"startTime\": \"09:00\"}"
                .formatted(taskId)),
        400,
        PlannerApi.ITEM_TIME);
    InitiativeAssertions.assertProblem(
        PlannerApi.postItem(
            "{\"taskId\": \"%s\", \"date\": \"2026-11-17\", \"endTime\": \"09:00\"}"
                .formatted(taskId)),
        400,
        PlannerApi.ITEM_TIME);
    InitiativeAssertions.assertProblem(
        PlannerApi.postItem("{\"taskId\": \"%s\"}".formatted(taskId)), 400, PlannerApi.ITEM_TIME);
    PlannerApi.planner(PlannerApi.MONDAY).body("items.size()", equalTo(0));
  }

  @Test
  @DisplayName("blocks of the same user cannot overlap, whatever their task")
  void overlap() {
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    for (String[] times :
        new String[][] {
          {"09:00", "10:00"},
          {"09:15", "09:45"},
          {"08:00", "09:15"},
          {"09:45", "11:00"},
          {"08:00", "11:00"}
        }) {
      InitiativeAssertions.assertProblem(
          PlannerApi.postItem(
              PlannerApi.blockJson(otherTaskId, PlannerApi.TUESDAY, times[0], times[1])),
          409,
          PlannerApi.OVERLAP);
      InitiativeAssertions.assertProblem(
          PlannerApi.postItem(PlannerApi.blockJson(taskId, PlannerApi.TUESDAY, times[0], times[1])),
          409,
          PlannerApi.OVERLAP);
    }
    PlannerApi.planner(PlannerApi.MONDAY).body("items.size()", equalTo(1));
  }

  @Test
  @DisplayName("blocks that touch, or sit on other days, or overlap an event, are fine")
  void noOverlap() {
    PlannerApi.createEventId("Dentist", PlannerApi.TUESDAY, "09:00", "10:00");
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "08:00", "09:00");
    PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "10:00", "11:00");
    PlannerApi.createBlockId(otherTaskId, PlannerApi.WEDNESDAY, "09:00", "10:00");
    PlannerApi.createDayListId(otherTaskId, PlannerApi.TUESDAY);
  }

  @Test
  @DisplayName("blocks of hidden tasks do not count for the overlap")
  void hiddenBlocksDoNotOverlap() {
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    TaskActions.archive(taskId).statusCode(200);

    PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "09:00", "10:00");
  }

  @Test
  @DisplayName("a task enters a day list once")
  void duplicate() {
    PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);

    InitiativeAssertions.assertProblem(
        PlannerApi.postItem(PlannerApi.dayListJson(taskId, PlannerApi.TUESDAY)),
        409,
        PlannerApi.DUPLICATE);
    PlannerApi.createDayListId(taskId, PlannerApi.WEDNESDAY);
    PlannerApi.createDayListId(otherTaskId, PlannerApi.TUESDAY);
  }

  @Test
  @DisplayName("a task that is done cannot be scheduled")
  void taskDone() {
    PlannerApi.markDone(taskId);

    InitiativeAssertions.assertProblem(
        PlannerApi.postItem(PlannerApi.dayListJson(taskId, PlannerApi.TUESDAY)),
        422,
        PlannerApi.TASK_DONE);
    InitiativeAssertions.assertProblem(
        PlannerApi.postItem(PlannerApi.blockJson(taskId, PlannerApi.TUESDAY, "09:00", "10:00")),
        422,
        PlannerApi.TASK_DONE);
  }

  @Test
  @DisplayName("an unknown, foreign or hidden task is 404")
  void unreachableTask() {
    InitiativeAssertions.assertNotFound(
        PlannerApi.postItem(
            PlannerApi.dayListJson("00000000-0000-0000-0000-0000000000aa", PlannerApi.TUESDAY)));
    TaskActions.archive(taskId).statusCode(200);
    InitiativeAssertions.assertNotFound(
        PlannerApi.postItem(PlannerApi.dayListJson(taskId, PlannerApi.TUESDAY)));
    TaskActions.unarchive(taskId).statusCode(200);
    TaskActions.delete(taskId).statusCode(204);
    InitiativeAssertions.assertNotFound(
        PlannerApi.postItem(PlannerApi.blockJson(taskId, PlannerApi.TUESDAY, "09:00", "10:00")));
  }

  @Test
  @DisplayName("a task whose phase or initiative is hidden is 404")
  void hiddenParents() {
    String phaseId = PhaseApi.createId(initiativeId, "Design");
    String inPhase = TaskApi.createIdInPhase(initiativeId, "Plan", phaseId);
    PhaseActions.archive(phaseId).statusCode(200);

    InitiativeAssertions.assertNotFound(
        PlannerApi.postItem(PlannerApi.dayListJson(inPhase, PlannerApi.TUESDAY)));

    InitiativeActions.archive(initiativeId).statusCode(200);

    InitiativeAssertions.assertNotFound(
        PlannerApi.postItem(PlannerApi.dayListJson(taskId, PlannerApi.TUESDAY)));
  }

  @Test
  @DisplayName("a task of another user is 404")
  void foreignTask() {
    String foreign = TestData.insertForeignTask(entityManager);

    InitiativeAssertions.assertNotFound(
        PlannerApi.postItem(PlannerApi.dayListJson(foreign, PlannerApi.TUESDAY)));
  }

  @Test
  @DisplayName("bodies are strict: bad types, unknown fields and a missing task are http.400")
  void strictBodies() {
    for (String body :
        new String[] {
          "{\"date\": \"2026-11-17\"}",
          "{\"taskId\": null, \"date\": \"2026-11-17\"}",
          "{\"taskId\": \"nope\", \"date\": \"2026-11-17\"}",
          "{\"taskId\": 1, \"date\": \"2026-11-17\"}",
          "{\"taskId\": \"%s\", \"date\": \"17/11/2026\"}",
          "{\"taskId\": \"%s\", \"date\": 20261117}",
          PlannerApi.blockJson("%s", PlannerApi.TUESDAY, "9:00", "10:00"),
          PlannerApi.blockJson("%s", PlannerApi.TUESDAY, "09:00", "24:00"),
          "{\"taskId\": \"%s\", \"date\": \"2026-11-17\", \"sortOrder\": 1}",
          "{\"taskId\": \"%s\", \"taskId\": \"%s\", \"date\": \"2026-11-17\"}",
          "[]",
          "{\"taskId\": \"%s\", \"date\": \"2026-11-17\"} x",
          ""
        }) {
      InitiativeAssertions.assertMalformed(PlannerApi.postItem(body.replace("%s", taskId)));
    }
    PlannerApi.planner(PlannerApi.MONDAY).body("items.size()", equalTo(0));
  }
}
