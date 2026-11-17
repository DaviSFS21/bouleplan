package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.equalTo;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskPhaseMoveRefusedResourceTest {

  private static final String PHASE_ID = "phaseId";
  private static final String TITLE = "title";

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String design;
  private String build;
  private String taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    design = PhaseApi.createId(initiativeId, "Design");
    build = PhaseApi.createId(initiativeId, "Build");
    taskId = TaskApi.createIdInPhase(initiativeId, "Write", design);
  }

  private static String body(String phaseId) {
    return "{\"phaseId\": " + (phaseId == null ? "null" : "\"" + phaseId + "\"") + "}";
  }

  @Test
  @DisplayName("a phase of another initiative is 404 and nothing changes")
  void otherInitiativePhase() {
    String otherInitiative = TaskApi.initiativeId("Other");
    String foreign = PhaseApi.createId(otherInitiative, "Elsewhere");

    InitiativeAssertions.assertNotFound(
        TaskApi.patch(taskId, "{\"phaseId\": \"" + foreign + "\", \"title\": \"Moved\"}"));

    TaskApi.get(taskId).body(PHASE_ID, equalTo(design)).body(TITLE, equalTo("Write"));
  }

  @Test
  @DisplayName("a phase of another user or an unknown phase is 404")
  void foreignAndUnknownPhase() {
    InitiativeAssertions.assertNotFound(
        TaskApi.patch(taskId, body(TestData.insertForeignPhase(entityManager))));
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(UUID.randomUUID().toString())));
  }

  @Test
  @DisplayName("an archived or deleted phase is 404, and the phase is usable again once back")
  void hiddenPhase() {
    PhaseActions.archive(build).statusCode(200);
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(build)));
    PhaseActions.unarchive(build).statusCode(200);

    PhaseActions.delete(build).statusCode(204);
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(build)));
    PhaseActions.restore(build).statusCode(200);

    TaskApi.patch(taskId, body(build)).statusCode(200).body(PHASE_ID, equalTo(build));
  }

  @Test
  @DisplayName("the implicit phase cannot be targeted by id")
  void implicitPhaseById() {
    String implicitPhase = TestData.insertImplicitPhase(initiativeId);

    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(implicitPhase)));
  }

  @Test
  @DisplayName("a mistyped or malformed phaseId is a malformed request")
  void strictTypes() {
    for (String value : new String[] {"1", "true", "[]", "{}", "\"not-a-uuid\"", "\"\""}) {
      InitiativeAssertions.assertMalformed(TaskApi.patch(taskId, "{\"phaseId\": " + value + "}"));
    }
    TaskApi.get(taskId).body(PHASE_ID, equalTo(design));
  }

  @Test
  @DisplayName("moving a task out of an archived phase is 404, as every write to it")
  void taskInHiddenPhase() {
    PhaseActions.archive(design).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(build)));
  }
}
