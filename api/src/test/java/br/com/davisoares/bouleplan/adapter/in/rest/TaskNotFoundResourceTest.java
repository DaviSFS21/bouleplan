package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskNotFoundResourceTest {

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    String phaseId = PhaseApi.createId(initiativeId, "Design");
    taskId = TaskApi.createIdInPhase(initiativeId, "Write", phaseId);
  }

  @Test
  @DisplayName("an unknown task is 404 for every operation")
  void unknownTask() {
    TaskAssertions.assertEveryOperationNotFound(UUID.randomUUID().toString());
  }

  @Test
  @DisplayName("a task of another user is 404 for every operation")
  void foreignTask() {
    TaskAssertions.assertEveryOperationNotFound(TestData.insertForeignTask(entityManager));
  }

  @Test
  @DisplayName("creating in an unknown or foreign initiative is 404")
  void createInUnknownInitiative() {
    InitiativeAssertions.assertNotFound(
        TaskApi.post(UUID.randomUUID().toString(), TaskApi.NEW_TITLE));
    InitiativeAssertions.assertNotFound(
        TaskApi.post(TestData.insertForeignInitiative(entityManager), TaskApi.NEW_TITLE));
  }

  @Test
  @DisplayName("an archived task is unreachable except to unarchive, a deleted one to restore")
  void archivedAndDeletedTask() {
    TaskActions.archive(taskId).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskApi.get(taskId));
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, TaskApi.NEW_TITLE));
    InitiativeAssertions.assertNotFound(TaskActions.archive(taskId));
    InitiativeAssertions.assertNotFound(TaskActions.delete(taskId));

    TaskActions.unarchive(taskId).statusCode(200);
    TaskActions.delete(taskId).statusCode(204);

    InitiativeAssertions.assertNotFound(TaskApi.get(taskId));
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, TaskApi.NEW_TITLE));
    InitiativeAssertions.assertNotFound(TaskActions.archive(taskId));
    InitiativeAssertions.assertNotFound(TaskActions.unarchive(taskId));
    InitiativeAssertions.assertNotFound(TaskActions.delete(taskId));
  }

  @Test
  @DisplayName("a phaseId that is unknown, foreign, of another initiative or implicit is 404")
  void invalidPhaseId() {
    String otherInitiative = TaskApi.initiativeId("Work");
    final String otherPhase = PhaseApi.createId(otherInitiative, "Other");
    String archivedPhase = PhaseApi.createId(initiativeId, "Archived");
    PhaseActions.archive(archivedPhase).statusCode(200);
    TaskApi.createId(otherInitiative, "creates the implicit phase");
    String implicit = TestData.insertImplicitPhase(initiativeId);

    InitiativeAssertions.assertNotFound(
        TaskApi.post(initiativeId, TaskAssertions.createBody(UUID.randomUUID().toString())));
    InitiativeAssertions.assertNotFound(
        TaskApi.post(
            initiativeId, TaskAssertions.createBody(TestData.insertForeignPhase(entityManager))));
    InitiativeAssertions.assertNotFound(
        TaskApi.post(initiativeId, TaskAssertions.createBody(otherPhase)));
    InitiativeAssertions.assertNotFound(
        TaskApi.post(initiativeId, TaskAssertions.createBody(archivedPhase)));
    InitiativeAssertions.assertNotFound(
        TaskApi.post(initiativeId, TaskAssertions.createBody(implicit)));
  }

  @Test
  @DisplayName("a refused create leaves no implicit phase and no task behind")
  void refusedCreateStoresNothing() {
    String otherInitiative = TaskApi.initiativeId("Work");

    InitiativeAssertions.assertNotFound(
        TaskApi.post(otherInitiative, TaskAssertions.createBody(UUID.randomUUID().toString())));
    InitiativeAssertions.assertProblem(
        TaskApi.post(otherInitiative, "{\"title\": \" \"}"), 400, TaskApi.BLANK);

    assertThat(TestData.countImplicitPhases(entityManager, otherInitiative)).isZero();
    TaskApi.list().body("size()", is(1));
  }
}
