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
class TaskEpicMoveResourceTest {

  private static final String EPIC_ID = "epicId";
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
    design = EpicApi.createId(initiativeId, "Design");
    build = EpicApi.createId(initiativeId, "Build");
    taskId = TaskApi.createIdInEpic(initiativeId, "Write", design);
  }

  private static String body(String epicId) {
    return "{\"epicId\": " + (epicId == null ? "null" : "\"" + epicId + "\"") + "}";
  }

  @Test
  @DisplayName("a task moves to another named epic of its initiative")
  void movesToNamedEpic() {
    TaskApi.patch(taskId, body(build)).statusCode(200).body(EPIC_ID, equalTo(build));

    TaskApi.get(taskId).body(EPIC_ID, equalTo(build));
    TaskApi.list().body("[0].epicId", equalTo(build));
  }

  @Test
  @DisplayName("moving to the epic it is already in is a no-op")
  void sameEpic() {
    TaskApi.patch(taskId, body(design)).statusCode(200).body(EPIC_ID, equalTo(design));
  }

  @Test
  @DisplayName("null moves the task to the implicit epic, created once and reused")
  void movesToImplicitEpic() {
    String other = TaskApi.createIdInEpic(initiativeId, "Other", design);
    assertThat(TestData.countImplicitEpics(entityManager, initiativeId)).isZero();

    TaskApi.patch(taskId, body(null)).statusCode(200).body(EPIC_ID, nullValue());
    TaskApi.patch(other, body(null)).statusCode(200).body(EPIC_ID, nullValue());

    assertThat(TestData.countImplicitEpics(entityManager, initiativeId)).isEqualTo(1);
    TaskApi.get(taskId).body(EPIC_ID, nullValue());
  }

  @Test
  @DisplayName("a task in the implicit epic moves to a named one and back")
  void roundTrip() {
    String implicit = TaskApi.createId(initiativeId, "Loose");

    TaskApi.patch(implicit, body(build)).statusCode(200).body(EPIC_ID, equalTo(build));
    TaskApi.patch(implicit, body(null)).statusCode(200).body(EPIC_ID, nullValue());

    assertThat(TestData.countImplicitEpics(entityManager, initiativeId)).isEqualTo(1);
  }

  @Test
  @DisplayName("a move can come with other fields in the same patch")
  void combined() {
    TaskApi.patch(taskId, "{\"epicId\": \"" + build + "\", \"title\": \"Moved\"}")
        .statusCode(200)
        .body(EPIC_ID, equalTo(build))
        .body(TITLE, equalTo("Moved"));
  }
}
