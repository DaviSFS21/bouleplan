package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@SuppressWarnings({
  "PMD.TooManyMethods",
  "PMD.AvoidDuplicateLiterals"
}) // one test per rule, times inline
class ScheduledItemUpdateResourceTest {

  private static final String START = "startTime";
  private static final String END = "endTime";
  private static final String SORT_ORDER = "sortOrder";
  private static final String DATE = "date";

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
  @DisplayName("PATCH moves a block to another time and day")
  void moveBlock() {
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    PlannerApi.patchItem(id, "{\"startTime\": \"14:00\", \"endTime\": \"15:00\"}")
        .statusCode(200)
        .body(START, equalTo("14:00"))
        .body(END, equalTo("15:00"));
    PlannerApi.patchItem(id, "{\"date\": \"2026-11-18\"}")
        .statusCode(200)
        .body(DATE, equalTo(PlannerApi.WEDNESDAY))
        .body(START, equalTo("14:00"))
        .body(SORT_ORDER, nullValue());
  }

  @Test
  @DisplayName("PATCH resizes a block with one time, and may overlap its own old place")
  void resizeBlock() {
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    PlannerApi.patchItem(id, "{\"endTime\": \"11:15\"}")
        .statusCode(200)
        .body(START, equalTo("09:00"))
        .body(END, equalTo("11:15"));
    PlannerApi.patchItem(id, "{\"startTime\": \"09:15\"}")
        .statusCode(200)
        .body(START, equalTo("09:15"));
    PlannerApi.patchItem(id, "{\"startTime\": \"09:30\", \"endTime\": \"10:30\"}").statusCode(200);
  }

  @Test
  @DisplayName("PATCH refuses a block that would overlap another one")
  void overlap() {
    PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "10:00", "11:00");
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(id, "{\"endTime\": \"10:15\"}"), 409, PlannerApi.OVERLAP);
    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(id, "{\"startTime\": \"10:30\", \"endTime\": \"11:30\"}"),
        409,
        PlannerApi.OVERLAP);
    PlannerApi.patchItem(id, "{\"date\": \"2026-11-18\"}").statusCode(200);
    PlannerApi.taskItems(taskId).body("[0].date", equalTo(PlannerApi.WEDNESDAY));
  }

  @Test
  @DisplayName("PATCH refuses invalid times with scheduled-item.time.invalid")
  void invalidTimes() {
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    for (String body :
        new String[] {
          "{\"endTime\": \"09:00\"}",
          "{\"startTime\": \"10:15\"}",
          "{\"startTime\": \"09:10\"}",
          "{\"endTime\": \"10:05\"}",
          "{\"startTime\": null}",
          "{\"endTime\": null}",
          "{\"sortOrder\": 1}",
          "{\"date\": \"0000-01-01\"}"
        }) {
      InitiativeAssertions.assertProblem(PlannerApi.patchItem(id, body), 400, PlannerApi.ITEM_TIME);
    }
    PlannerApi.taskItems(taskId).body("[0].startTime", equalTo("09:00"));
  }

  @Test
  @DisplayName("PATCH turns a day-list entry into a block and back")
  void turnIntoBlockAndBack() {
    PlannerApi.createDayListId(otherTaskId, PlannerApi.TUESDAY);
    String id = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);

    PlannerApi.patchItem(id, "{\"startTime\": \"09:00\", \"endTime\": \"10:00\"}")
        .statusCode(200)
        .body(START, equalTo("09:00"))
        .body(END, equalTo("10:00"))
        .body(SORT_ORDER, nullValue());
    PlannerApi.patchItem(id, "{\"startTime\": null, \"endTime\": null}")
        .statusCode(200)
        .body(START, nullValue())
        .body(END, nullValue())
        .body(DATE, equalTo(PlannerApi.TUESDAY))
        .body(SORT_ORDER, equalTo(1));
  }

  @Test
  @DisplayName("PATCH turns an entry into a block on another day with the date in the same body")
  void turnIntoBlockOnAnotherDay() {
    String id = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);

    PlannerApi.patchItem(
            id, "{\"date\": \"2026-11-18\", \"startTime\": \"08:00\", \"endTime\": \"08:15\"}")
        .statusCode(200)
        .body(DATE, equalTo(PlannerApi.WEDNESDAY))
        .body(END, equalTo("08:15"));
  }

  @Test
  @DisplayName("PATCH refuses to turn an entry into a block that overlaps, or with one time")
  void turnIntoBlockRefused() {
    PlannerApi.createBlockId(otherTaskId, PlannerApi.TUESDAY, "09:00", "10:00");
    String id = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);

    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(id, "{\"startTime\": \"09:30\", \"endTime\": \"10:30\"}"),
        409,
        PlannerApi.OVERLAP);
    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(id, "{\"startTime\": \"11:00\"}"), 400, PlannerApi.ITEM_TIME);
    PlannerApi.patchItem(id, "{}").body(START, nullValue()).body(SORT_ORDER, equalTo(0));
  }

  @Test
  @DisplayName("PATCH moves an entry to another day, appending, and refuses a duplicate there")
  void moveEntryToAnotherDay() {
    PlannerApi.createDayListId(otherTaskId, PlannerApi.WEDNESDAY);
    String id = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);

    PlannerApi.patchItem(id, "{\"date\": \"2026-11-18\"}")
        .statusCode(200)
        .body(DATE, equalTo(PlannerApi.WEDNESDAY))
        .body(SORT_ORDER, equalTo(1));

    String again = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(again, "{\"date\": \"2026-11-18\"}"), 409, PlannerApi.DUPLICATE);
    PlannerApi.patchItem(again, "{\"sortOrder\": 5}").statusCode(200).body(SORT_ORDER, equalTo(5));
  }

  @Test
  @DisplayName("PATCH reorders a day-list entry with sortOrder; null appends; absent keeps")
  void reorder() {
    String first = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
    PlannerApi.createDayListId(otherTaskId, PlannerApi.TUESDAY);

    PlannerApi.patchItem(first, "{\"sortOrder\": 7}").body(SORT_ORDER, equalTo(7));
    PlannerApi.patchItem(first, "{}").body(SORT_ORDER, equalTo(7));
    PlannerApi.patchItem(first, "{\"sortOrder\": 0}").body(SORT_ORDER, equalTo(0));
    PlannerApi.patchItem(first, "{\"sortOrder\": null}").body(SORT_ORDER, equalTo(2));
    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(first, "{\"sortOrder\": -1}"), 400, PlannerApi.ITEM_TIME);
    PlannerApi.planner(PlannerApi.MONDAY)
        .body("items.taskId", org.hamcrest.Matchers.contains(otherTaskId, taskId));
  }

  @Test
  @DisplayName("PATCH an item of a task that is done is 422")
  void taskDone() {
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    PlannerApi.markDone(taskId);

    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(id, "{\"endTime\": \"10:15\"}"), 422, PlannerApi.TASK_DONE);
    PlannerApi.deleteItem(id).statusCode(204);
  }

  @Test
  @DisplayName("bodies are strict: bad types, unknown fields and a null date are http.400")
  void strictBodies() {
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    for (String body :
        new String[] {
          "{\"date\": null}",
          "{\"date\": \"x\"}",
          "{\"startTime\": 900}",
          "{\"startTime\": \"9:00\"}",
          "{\"endTime\": \"24:00\"}",
          "{\"sortOrder\": \"1\"}",
          "{\"sortOrder\": 1.5}",
          "{\"sortOrder\": 99999999999}",
          "{\"taskId\": \"%s\"}",
          "{\"id\": \"x\"}",
          "{\"date\": \"2026-11-18\", \"date\": \"2026-11-19\"}",
          "[]",
          ""
        }) {
      InitiativeAssertions.assertMalformed(PlannerApi.patchItem(id, body.replace("%s", taskId)));
    }
    PlannerApi.taskItems(taskId).body("[0].date", equalTo(PlannerApi.TUESDAY));
  }
}
