package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.ValidatableResponse;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskResourceTest {

  private static final String PHASE_ID = "phaseId";
  private static final String WRITE = "Write";
  private static final String DESIGN = "Design";

  @Inject EntityManager entityManager;

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
  }

  @Test
  @DisplayName("there are no tasks at first")
  void emptyList() {
    TaskApi.list().statusCode(200).body("", Matchers.empty());
  }

  @Test
  @DisplayName("create returns 201 with the defaults, the implicit phase as null, and no internals")
  void create() {
    String id = TaskApi.createId(initiativeId, " Write ");

    TaskApi.get(id)
        .statusCode(200)
        .body("id", Matchers.equalTo(id))
        .body("initiativeId", Matchers.equalTo(initiativeId))
        .body(PHASE_ID, Matchers.nullValue())
        .body(TaskApi.TITLE, Matchers.equalTo(WRITE))
        .body("description", Matchers.nullValue())
        .body("deadline", Matchers.nullValue())
        .body("estimatedEffort", Matchers.nullValue())
        .body("priority", Matchers.equalTo("P2"))
        .body("status", Matchers.equalTo("to_do"))
        .body("isBlocked", Matchers.equalTo(false))
        .body("plannedWeekStart", Matchers.nullValue())
        .body("createdAt", Matchers.notNullValue())
        .body("updatedAt", Matchers.notNullValue())
        .body("$", Matchers.hasKey(PHASE_ID))
        .body("$", Matchers.not(Matchers.hasKey("origin")))
        .body("$", Matchers.not(Matchers.hasKey("archivedAt")))
        .body("$", Matchers.not(Matchers.hasKey("blocked")));
  }

  @Test
  @DisplayName("the Location header points to the created task")
  void location() {
    ValidatableResponse response =
        TaskApi.post(initiativeId, "{\"title\": \"Write\"}").statusCode(201);
    String id = response.extract().path("id");

    response.header("Location", Matchers.endsWith("/tasks/" + id));
    TaskApi.get(id).statusCode(200);
  }

  @Test
  @DisplayName("create accepts a status and a named phase of the initiative")
  void createWithStatusAndPhase() {
    String phaseId = PhaseApi.createId(initiativeId, DESIGN);

    TaskApi.post(
            initiativeId,
            "{\"title\": \"Write\", \"status\": \"in_progress\", \"phaseId\": \"" + phaseId + "\"}")
        .statusCode(201)
        .body("status", Matchers.equalTo("in_progress"))
        .body(PHASE_ID, Matchers.equalTo(phaseId))
        .body("initiativeId", Matchers.equalTo(initiativeId));
  }

  @Test
  @DisplayName("a null phaseId means the implicit phase, like an absent one")
  void nullPhaseId() {
    TaskApi.post(initiativeId, "{\"title\": \"Write\", \"phaseId\": null}")
        .statusCode(201)
        .body(PHASE_ID, Matchers.nullValue());
  }

  @Test
  @DisplayName("the implicit phase is created once and reused, even when named phases exist")
  void implicitPhaseCreatedOnce() {
    TaskApi.createId(initiativeId, "A");
    PhaseApi.createId(initiativeId, DESIGN);
    TaskApi.createId(initiativeId, "B");

    TaskApi.list().body(PHASE_ID, Matchers.contains(Matchers.nullValue(), Matchers.nullValue()));
    assertThat(TestData.countImplicitPhases(entityManager, initiativeId)).isEqualTo(1);
    PhaseApi.list(initiativeId).body(PhaseApi.NAME, Matchers.contains(DESIGN));
  }

  @Test
  @DisplayName("creating named phases later never moves tasks of the implicit phase")
  void namedPhasesDoNotMoveTasks() {
    String id = TaskApi.createId(initiativeId, "A");
    String phaseId = PhaseApi.createId(initiativeId, DESIGN);

    TaskApi.get(id).body(PHASE_ID, Matchers.nullValue());
    TaskApi.createIdInPhase(initiativeId, "B", phaseId);
    TaskApi.get(id).body(PHASE_ID, Matchers.nullValue());
  }
}
