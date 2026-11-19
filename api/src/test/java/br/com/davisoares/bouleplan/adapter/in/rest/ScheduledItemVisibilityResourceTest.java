package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ScheduledItemVisibilityResourceTest {

  private static final String ITEMS = "items";

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String epicId;
  private String taskId;
  private String blockId;
  private String entryId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    epicId = EpicApi.createId(initiativeId, "Design");
    taskId = TaskApi.createIdInEpic(initiativeId, "Write", epicId);
    blockId = PlannerApi.createBlockId(taskId, PlannerApi.TUESDAY, "09:00", "10:00");
    entryId = PlannerApi.createDayListId(taskId, PlannerApi.TUESDAY);
  }

  private void assertHidden() {
    PlannerApi.planner(PlannerApi.MONDAY).statusCode(200).body(ITEMS, empty());
    InitiativeAssertions.assertNotFound(PlannerApi.taskItems(taskId));
    InitiativeAssertions.assertNotFound(PlannerApi.patchItem(blockId, "{}"));
    InitiativeAssertions.assertNotFound(PlannerApi.patchItem(entryId, "{}"));
    InitiativeAssertions.assertNotFound(PlannerApi.deleteItem(blockId));
    InitiativeAssertions.assertNotFound(PlannerApi.deleteItem(entryId));
  }

  private void assertBack() {
    PlannerApi.planner(PlannerApi.MONDAY).body("items.size()", equalTo(2));
    PlannerApi.taskItems(taskId).statusCode(200).body("size()", equalTo(1));
    PlannerApi.patchItem(blockId, "{}").statusCode(200);
    PlannerApi.patchItem(entryId, "{}").statusCode(200);
  }

  @Test
  @DisplayName("an archived or deleted task hides its items, which come back with it")
  void task() {
    TaskActions.archive(taskId).statusCode(200);
    assertHidden();
    TaskActions.unarchive(taskId).statusCode(200);
    assertBack();

    TaskActions.delete(taskId).statusCode(204);
    assertHidden();
    TaskActions.restore(taskId).statusCode(200);
    assertBack();
  }

  @Test
  @DisplayName("an archived or deleted epic hides the items of its tasks")
  void epic() {
    EpicActions.archive(epicId).statusCode(200);
    assertHidden();
    EpicActions.unarchive(epicId).statusCode(200);
    assertBack();

    EpicActions.delete(epicId).statusCode(204);
    assertHidden();
    EpicActions.restore(epicId).statusCode(200);
    assertBack();
  }

  @Test
  @DisplayName("an archived or deleted initiative hides the items of its tasks")
  void initiative() {
    InitiativeActions.archive(initiativeId).statusCode(200);
    assertHidden();
    InitiativeActions.unarchive(initiativeId).statusCode(200);
    assertBack();

    InitiativeActions.delete(initiativeId).statusCode(204);
    assertHidden();
    InitiativeActions.restore(initiativeId).statusCode(200);
    assertBack();
  }

  @Test
  @DisplayName("DELETE removes an item for good; an unknown item is 404")
  void delete() {
    PlannerApi.deleteItem(blockId).statusCode(204);
    PlannerApi.deleteItem(entryId).statusCode(204);

    PlannerApi.planner(PlannerApi.MONDAY).body(ITEMS, empty());
    InitiativeAssertions.assertNotFound(PlannerApi.deleteItem(blockId));
    InitiativeAssertions.assertNotFound(PlannerApi.patchItem(blockId, "{}"));
    InitiativeAssertions.assertNotFound(
        PlannerApi.deleteItem("00000000-0000-0000-0000-0000000000aa"));
    PlannerApi.taskItems(taskId).body("", empty());
  }

  @Test
  @DisplayName("the item of a task of another user is 404")
  void foreignItem() {
    String foreign = TestData.insertForeignTask(entityManager);
    String item = TestData.insertForeignItem(entityManager, foreign);

    InitiativeAssertions.assertNotFound(PlannerApi.patchItem(item, "{}"));
    InitiativeAssertions.assertNotFound(PlannerApi.deleteItem(item));
    InitiativeAssertions.assertNotFound(PlannerApi.taskItems(foreign));
    PlannerApi.planner(PlannerApi.MONDAY).body("items.size()", equalTo(2));
  }
}
