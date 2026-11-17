package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskBlockerNotFoundResourceTest {

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String first;
  private String second;
  private String third;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    first = TaskApi.createId(initiativeId, "A");
    second = TaskApi.createId(initiativeId, "B");
    third = TaskApi.createId(initiativeId, "C");
  }

  @Test
  @DisplayName("an unknown or foreign task on either side is 404, for PUT and DELETE")
  void unreachable() {
    String foreign = TestData.insertForeignTask(entityManager);
    for (String other : new String[] {UUID.randomUUID().toString(), foreign}) {
      InitiativeAssertions.assertNotFound(TaskBlockerApi.block(first, other));
      InitiativeAssertions.assertNotFound(TaskBlockerApi.block(other, first));
      InitiativeAssertions.assertNotFound(TaskBlockerApi.unblock(first, other));
      InitiativeAssertions.assertNotFound(TaskBlockerApi.unblock(other, first));
    }
    InitiativeAssertions.assertNotFound(
        TaskBlockerApi.block(UUID.randomUUID().toString(), UUID.randomUUID().toString()));
  }

  @Test
  @DisplayName("an archived or deleted task on either side is 404")
  void hiddenTask() {
    TaskActions.archive(second).statusCode(200);
    TaskActions.delete(third).statusCode(204);

    InitiativeAssertions.assertNotFound(TaskBlockerApi.block(first, second));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.block(second, first));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.unblock(first, second));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.block(first, third));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.unblock(third, first));
  }

  @Test
  @DisplayName("a task in an archived phase is 404 until it comes back")
  void hiddenPhase() {
    String phase = PhaseApi.createId(initiativeId, "Design");
    String inPhase = TaskApi.createIdInPhase(initiativeId, "In phase", phase);
    PhaseActions.archive(phase).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskBlockerApi.block(first, inPhase));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.unblock(inPhase, first));

    PhaseActions.unarchive(phase).statusCode(200);
    TaskBlockerApi.block(first, inPhase).statusCode(204);
  }

  @Test
  @DisplayName("a task in an archived initiative is 404 until it comes back")
  void hiddenInitiative() {
    String otherInitiative = TaskApi.initiativeId("Other");
    String elsewhere = TaskApi.createId(otherInitiative, "Elsewhere");
    InitiativeActions.archive(otherInitiative).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskBlockerApi.block(elsewhere, first));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.unblock(first, elsewhere));

    InitiativeActions.unarchive(otherInitiative).statusCode(200);
    TaskBlockerApi.block(elsewhere, first).statusCode(204);
  }

  @Test
  @DisplayName("a malformed task id in the path is 404")
  void malformedPath() {
    InitiativeAssertions.assertNotFound(TaskBlockerApi.block("nope", second));
    InitiativeAssertions.assertNotFound(TaskBlockerApi.block(first, "nope"));
  }
}
