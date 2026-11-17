package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskHierarchyResourceTest {

  private String initiativeId;
  private String phaseId;
  private String taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    phaseId = PhaseApi.createId(initiativeId, "Design");
    taskId = TaskApi.createIdInPhase(initiativeId, "Write", phaseId);
  }

  @Test
  @DisplayName("an archived initiative makes its tasks unreachable until it comes back")
  void archivedInitiative() {
    InitiativeActions.archive(initiativeId).statusCode(200);

    TaskAssertions.assertEveryOperationNotFound(taskId);
    InitiativeAssertions.assertNotFound(TaskApi.post(initiativeId, TaskApi.NEW_TITLE));

    InitiativeActions.unarchive(initiativeId).statusCode(200);
    TaskApi.get(taskId).statusCode(200);
  }

  @Test
  @DisplayName("a deleted initiative makes its tasks unreachable until it is restored")
  void deletedInitiative() {
    InitiativeActions.delete(initiativeId).statusCode(204);

    TaskAssertions.assertEveryOperationNotFound(taskId);
    InitiativeAssertions.assertNotFound(TaskApi.post(initiativeId, TaskApi.NEW_TITLE));

    InitiativeActions.restore(initiativeId).statusCode(200);
    TaskApi.get(taskId).statusCode(200);
  }

  @Test
  @DisplayName("an archived phase makes its tasks unreachable until it comes back")
  void archivedPhase() {
    PhaseActions.archive(phaseId).statusCode(200);

    TaskAssertions.assertEveryOperationNotFound(taskId);
    InitiativeAssertions.assertNotFound(
        TaskApi.post(initiativeId, TaskAssertions.createBody(phaseId)));

    PhaseActions.unarchive(phaseId).statusCode(200);
    TaskApi.get(taskId).statusCode(200);
  }

  @Test
  @DisplayName("a deleted phase makes its tasks unreachable until it is restored")
  void deletedPhase() {
    PhaseActions.delete(phaseId).statusCode(204);

    TaskAssertions.assertEveryOperationNotFound(taskId);
    InitiativeAssertions.assertNotFound(
        TaskApi.post(initiativeId, TaskAssertions.createBody(phaseId)));

    PhaseActions.restore(phaseId).statusCode(200);
    TaskApi.get(taskId).statusCode(200);
  }
}
