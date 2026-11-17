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
@SuppressWarnings({
  "PMD.TooManyMethods",
  "PMD.AvoidDuplicateLiterals"
}) // one test per rule, times inline
class TaskReservationResourceTest {

  private static final String RESERVED = "reservedMinutes";
  private static final String BY_DEADLINE = "reservedByDeadlineMinutes";

  private String initiativeId;
  private String taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    taskId = TaskApi.createId(initiativeId, "Write");
  }

  private void assertReserved(long all, long byDeadline) {
    TaskApi.get(taskId)
        .body(RESERVED, equalTo((int) all))
        .body(BY_DEADLINE, equalTo((int) byDeadline));
  }

  @Test
  @DisplayName("a task without blocks has 0 reserved minutes")
  void none() {
    assertReserved(0, 0);
    PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
    assertReserved(0, 0);
  }

  @Test
  @DisplayName("without a deadline every block counts for both numbers")
  void noDeadline() {
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:30");
    PlannerApi.createBlockId(taskId, "2030-01-01", "09:00", "09:15");

    assertReserved(105, 105);
  }

  @Test
  @DisplayName("blocks before, on and after the deadline add up as specified")
  void deadline() {
    TaskApi.patch(taskId, "{\"deadline\": \"2026-11-18\"}").statusCode(200);
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    assertReserved(60, 60);
    PlannerApi.createBlockId(taskId, PlannerApi.WEDNESDAY, "09:00", "09:45");
    assertReserved(105, 105);
    PlannerApi.createBlockId(taskId, "2026-11-19", "09:00", "11:00");

    assertReserved(225, 105);
  }

  @Test
  @DisplayName("changing the deadline recomputes the minutes by deadline")
  void deadlineChange() {
    PlannerApi.createBlockId(taskId, "2026-11-19", "09:00", "10:00");
    TaskApi.patch(taskId, "{\"deadline\": \"2026-11-18\"}");
    assertReserved(60, 0);

    TaskApi.patch(taskId, "{\"deadline\": \"2026-11-19\"}");
    assertReserved(60, 60);
    TaskApi.patch(taskId, "{\"deadline\": null}");
    assertReserved(60, 60);
  }

  @Test
  @DisplayName("moving and deleting blocks updates the minutes")
  void moveAndDelete() {
    TaskApi.patch(taskId, "{\"deadline\": \"2026-11-18\"}");
    String id = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");

    PlannerApi.patchItem(id, "{\"endTime\": \"11:00\"}");
    assertReserved(120, 120);
    PlannerApi.patchItem(id, "{\"date\": \"2026-11-19\"}");
    assertReserved(120, 0);
    PlannerApi.deleteItem(id);
    assertReserved(0, 0);
  }

  @Test
  @DisplayName("blocks of hidden tasks are not listed and come back with the task")
  void hiddenBlocks() {
    String other = TaskApi.createId(initiativeId, "Read");
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    PlannerApi.createBlockId(other, PlannerApi.TUESDAY, "10:00", "11:30");
    TaskActions.archive(taskId).statusCode(200);

    TaskApi.list().body("id", contains(other)).body("[0].reservedMinutes", equalTo(90));
    InitiativeAssertions.assertNotFound(PlannerApi.taskItems(taskId));
    TaskActions.unarchive(taskId).statusCode(200).body(RESERVED, equalTo(60));
    TaskApi.list().body("find { it.id == '%s' }.reservedMinutes".formatted(taskId), equalTo(60));
  }

  @Test
  @DisplayName("the task list carries the minutes of every task with one grouped query")
  void taskList() {
    String other = TaskApi.createId(initiativeId, "Read");
    String empty = TaskApi.createId(initiativeId, "Rest");
    PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    PlannerApi.createBlockId(other, PlannerApi.TUESDAY, "10:00", "11:30");

    TaskApi.list()
        .body("find { it.id == '%s' }.reservedMinutes".formatted(taskId), equalTo(60))
        .body("find { it.id == '%s' }.reservedMinutes".formatted(other), equalTo(90))
        .body("find { it.id == '%s' }.reservedMinutes".formatted(empty), equalTo(0))
        .body("find { it.id == '%s' }.reservedByDeadlineMinutes".formatted(empty), equalTo(0));
  }

  @Test
  @DisplayName(
      "GET /tasks/{id}/scheduled-items lists the blocks by date and start, not the entries")
  void taskItems() {
    PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
    String late = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "14:00", "15:00");
    String early = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "08:00", "09:00");
    String before = PlannerApi.createBlockId(taskId, PlannerApi.MONDAY, "18:00", "19:00");
    String other = TaskApi.createId(initiativeId, "Read");
    PlannerApi.createBlockId(other, PlannerApi.TUESDAY, "10:00", "11:00");

    PlannerApi.taskItems(taskId).statusCode(200).body("id", contains(before, early, late));
    PlannerApi.taskItems(other).body("size()", equalTo(1));
    PlannerApi.taskItems(TaskApi.createId(initiativeId, "Empty")).body("", empty());
  }

  @Test
  @DisplayName("GET /tasks/{id}/scheduled-items is 404 for an unknown task")
  void unknownTask() {
    InitiativeAssertions.assertNotFound(
        PlannerApi.taskItems("00000000-0000-0000-0000-0000000000aa"));
  }
}
