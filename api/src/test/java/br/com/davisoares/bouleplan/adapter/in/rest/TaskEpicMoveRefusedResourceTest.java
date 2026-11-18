package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
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
class TaskEpicMoveRefusedResourceTest {

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
  @DisplayName("an epic of another initiative is 404 and nothing changes")
  void otherInitiativeEpic() {
    String otherInitiative = TaskApi.initiativeId("Other");
    String foreign = EpicApi.createId(otherInitiative, "Elsewhere");

    InitiativeAssertions.assertNotFound(
        TaskApi.patch(taskId, "{\"epicId\": \"" + foreign + "\", \"title\": \"Moved\"}"));

    TaskApi.get(taskId).body(EPIC_ID, equalTo(design)).body(TITLE, equalTo("Write"));
  }

  @Test
  @DisplayName("an epic of another user or an unknown epic is 404")
  void foreignAndUnknownEpic() {
    InitiativeAssertions.assertNotFound(
        TaskApi.patch(taskId, body(TestData.insertForeignEpic(entityManager))));
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(UUID.randomUUID().toString())));
  }

  @Test
  @DisplayName("an archived or deleted epic is 404, and the epic is usable again once back")
  void hiddenEpic() {
    EpicActions.archive(build).statusCode(200);
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(build)));
    EpicActions.unarchive(build).statusCode(200);

    EpicActions.delete(build).statusCode(204);
    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(build)));
    EpicActions.restore(build).statusCode(200);

    TaskApi.patch(taskId, body(build)).statusCode(200).body(EPIC_ID, equalTo(build));
  }

  @Test
  @DisplayName("the implicit epic cannot be targeted by id")
  void implicitEpicById() {
    String implicitEpic = TestData.insertImplicitEpic(initiativeId);

    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(implicitEpic)));
  }

  @Test
  @DisplayName("a mistyped or malformed epicId is a malformed request")
  void strictTypes() {
    for (String value : new String[] {"1", "true", "[]", "{}", "\"not-a-uuid\"", "\"\""}) {
      InitiativeAssertions.assertMalformed(TaskApi.patch(taskId, "{\"epicId\": " + value + "}"));
    }
    TaskApi.get(taskId).body(EPIC_ID, equalTo(design));
  }

  @Test
  @DisplayName("moving a task out of an archived epic is 404, as every write to it")
  void taskInHiddenEpic() {
    EpicActions.archive(design).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(build)));
  }

  @Test
  @DisplayName("a refused move to the implicit epic of a hidden task creates no epic")
  void hiddenTaskCreatesNoImplicitEpic() {
    TaskActions.archive(taskId).statusCode(200);

    InitiativeAssertions.assertNotFound(TaskApi.patch(taskId, body(null)));

    assertThat(TestData.countImplicitEpics(entityManager, initiativeId)).isZero();
  }
}
