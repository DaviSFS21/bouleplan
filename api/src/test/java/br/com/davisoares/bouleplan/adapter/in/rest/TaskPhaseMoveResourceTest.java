package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskPhaseMoveResourceTest {

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
  @DisplayName("a task moves to another named phase of its initiative")
  void movesToNamedPhase() {
    TaskApi.patch(taskId, body(build)).statusCode(200).body(PHASE_ID, equalTo(build));

    TaskApi.get(taskId).body(PHASE_ID, equalTo(build));
    TaskApi.list().body("[0].phaseId", equalTo(build));
  }

  @Test
  @DisplayName("moving to the phase it is already in is a no-op")
  void samePhase() {
    TaskApi.patch(taskId, body(design)).statusCode(200).body(PHASE_ID, equalTo(design));
  }

  @Test
  @DisplayName("null moves the task to the implicit phase, created once and reused")
  void movesToImplicitPhase() {
    String other = TaskApi.createIdInPhase(initiativeId, "Other", design);
    assertThat(TestData.countImplicitPhases(entityManager, initiativeId)).isZero();

    TaskApi.patch(taskId, body(null)).statusCode(200).body(PHASE_ID, nullValue());
    TaskApi.patch(other, body(null)).statusCode(200).body(PHASE_ID, nullValue());

    assertThat(TestData.countImplicitPhases(entityManager, initiativeId)).isEqualTo(1);
    TaskApi.get(taskId).body(PHASE_ID, nullValue());
  }

  @Test
  @DisplayName("a task in the implicit phase moves to a named one and back")
  void roundTrip() {
    String implicit = TaskApi.createId(initiativeId, "Loose");

    TaskApi.patch(implicit, body(build)).statusCode(200).body(PHASE_ID, equalTo(build));
    TaskApi.patch(implicit, body(null)).statusCode(200).body(PHASE_ID, nullValue());

    assertThat(TestData.countImplicitPhases(entityManager, initiativeId)).isEqualTo(1);
  }

  @Test
  @DisplayName("a move can come with other fields in the same patch")
  void combined() {
    TaskApi.patch(taskId, "{\"phaseId\": \"" + build + "\", \"title\": \"Moved\"}")
        .statusCode(200)
        .body(PHASE_ID, equalTo(build))
        .body(TITLE, equalTo("Moved"));
  }
}
