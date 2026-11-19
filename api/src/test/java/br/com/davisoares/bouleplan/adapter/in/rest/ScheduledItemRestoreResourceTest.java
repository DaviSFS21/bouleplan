package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.containsInAnyOrder;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ScheduledItemRestoreResourceTest {

  private String initiativeId;
  private String epicId;
  private String hiddenTask;
  private String visibleTask;
  private String hiddenBlock;
  private String newBlock;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    epicId = EpicApi.createId(initiativeId, "Design");
    hiddenTask = TaskApi.createIdInEpic(initiativeId, "Write", epicId);
    visibleTask = TaskApi.createId(initiativeId, "Read");
    hiddenBlock = PlannerApi.createBlockId(hiddenTask, PlannerApi.TUESDAY, "09:00", "10:00");
  }

  // Restoring brings back exactly what was there, so it may overlap what was planned meanwhile.
  private void assertRestoredOverlap() {
    PlannerApi.planner(PlannerApi.MONDAY)
        .statusCode(200)
        .body("items.id", containsInAnyOrder(hiddenBlock, newBlock));
    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(newBlock, "{\"startTime\": \"09:00\", \"endTime\": \"10:00\"}"),
        409,
        PlannerApi.OVERLAP);
    InitiativeAssertions.assertProblem(
        PlannerApi.patchItem(hiddenBlock, "{\"startTime\": \"09:15\"}"), 409, PlannerApi.OVERLAP);
  }

  private void planWhileHidden() {
    newBlock = PlannerApi.createBlockId(visibleTask, PlannerApi.TUESDAY, "09:30", "10:30");
  }

  @Test
  @DisplayName("unarchiving a task brings its block back, even over a newer one")
  void unarchiveTask() {
    TaskActions.archive(hiddenTask).statusCode(200);
    planWhileHidden();

    TaskActions.unarchive(hiddenTask).statusCode(200);

    assertRestoredOverlap();
  }

  @Test
  @DisplayName("restoring a deleted task brings its block back, even over a newer one")
  void restoreTask() {
    TaskActions.delete(hiddenTask).statusCode(204);
    planWhileHidden();

    TaskActions.restore(hiddenTask).statusCode(200);

    assertRestoredOverlap();
  }

  @Test
  @DisplayName("unarchiving an epic brings the blocks of its tasks back, even over a newer one")
  void unarchiveEpic() {
    EpicActions.archive(epicId).statusCode(200);
    planWhileHidden();

    EpicActions.unarchive(epicId).statusCode(200);

    assertRestoredOverlap();
  }

  @Test
  @DisplayName("restoring an initiative brings the blocks of its tasks back, even over a newer one")
  void restoreInitiative() {
    String otherInitiative = TaskApi.initiativeId("Work");
    visibleTask = TaskApi.createId(otherInitiative, "Other");
    InitiativeActions.delete(initiativeId).statusCode(204);
    planWhileHidden();

    InitiativeActions.restore(initiativeId).statusCode(200);

    assertRestoredOverlap();
  }
}
