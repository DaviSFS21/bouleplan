package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskRelationsResourceTest {

  private static final String BLOCKS = "blocks";
  private static final String BLOCKED_BY = "blockedBy";

  private String initiativeId;
  private String epicId;
  private String first;
  private String second;
  private String third;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
    epicId = EpicApi.createId(initiativeId, "Design");
    first = TaskApi.createId(initiativeId, "A");
    second = TaskApi.createIdInEpic(initiativeId, "B", epicId);
    third = TaskApi.createId(initiativeId, "C");
    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(first, third).statusCode(204);
  }

  @Test
  @DisplayName("every task response carries both relation lists, even when empty")
  void everyResponse() {
    String lonely = TaskApi.createId(initiativeId, "Lonely");

    TaskApi.get(lonely).body(BLOCKS, empty()).body(BLOCKED_BY, empty());
    TaskApi.post(initiativeId, TaskApi.NEW_TITLE)
        .statusCode(201)
        .body(BLOCKS, empty())
        .body(BLOCKED_BY, empty());
    TaskApi.patch(first, "{\"title\": \"A2\"}").body(BLOCKS, contains(second, third));
    TaskActions.archive(lonely).statusCode(200).body(BLOCKS, empty()).body(BLOCKED_BY, empty());
  }

  @Test
  @DisplayName("the list shows the relations of each task")
  void list() {
    TaskApi.list()
        .body("find { it.id == '" + first + "' }.blocks", contains(second, third))
        .body("find { it.id == '" + second + "' }.blockedBy", contains(first))
        .body("find { it.id == '" + third + "' }.blockedBy", contains(first));
  }

  @Test
  @DisplayName("relations are sorted like the task list: priority, deadline, creation")
  void sorted() {
    TaskApi.patch(third, "{\"priority\": \"P1\"}").statusCode(200);

    TaskApi.get(first).body(BLOCKS, contains(third, second));

    TaskApi.patch(third, "{\"priority\": \"P2\", \"deadline\": \"2026-12-01\"}").statusCode(200);
    TaskApi.patch(second, "{\"deadline\": \"2026-12-02\"}").statusCode(200);

    TaskApi.get(first).body(BLOCKS, contains(third, second));
  }

  @Test
  @DisplayName("an archived or deleted task disappears from the other side and comes back")
  void hiddenTask() {
    TaskActions.archive(second).statusCode(200);
    TaskActions.delete(third).statusCode(204);

    TaskApi.get(first).body(BLOCKS, empty());

    TaskActions.unarchive(second).statusCode(200);
    TaskActions.restore(third).statusCode(200);

    TaskApi.get(first).body(BLOCKS, contains(second, third));
    TaskApi.get(second).body(BLOCKED_BY, contains(first));
  }

  @Test
  @DisplayName("a task in an archived epic disappears from the other side and comes back")
  void hiddenEpic() {
    EpicActions.archive(epicId).statusCode(200);

    TaskApi.get(first).body(BLOCKS, contains(third));

    EpicActions.unarchive(epicId).statusCode(200);

    TaskApi.get(first).body(BLOCKS, contains(second, third));
  }

  @Test
  @DisplayName("a task in an archived initiative disappears from the other side and comes back")
  void hiddenInitiative() {
    String otherInitiative = TaskApi.initiativeId("Other");
    String elsewhere = TaskApi.createId(otherInitiative, "Elsewhere");
    TaskBlockerApi.block(elsewhere, first).statusCode(204);
    TaskBlockerApi.block(first, elsewhere).statusCode(422);
    InitiativeActions.archive(otherInitiative).statusCode(200);

    TaskApi.get(first).body(BLOCKED_BY, empty());

    InitiativeActions.unarchive(otherInitiative).statusCode(200);

    TaskApi.get(first).body(BLOCKED_BY, contains(elsewhere));
  }

  @Test
  @DisplayName("an archived task still answers its own relations on the archive response")
  void archiveResponse() {
    TaskActions.archive(first).statusCode(200).body(BLOCKS, contains(second, third));
    TaskActions.unarchive(first).statusCode(200).body(BLOCKS, contains(second, third));
  }

  @Test
  @DisplayName("moving a task to another epic keeps its relations")
  void epicMove() {
    TaskApi.patch(second, "{\"epicId\": null}").statusCode(200).body(BLOCKED_BY, contains(first));

    TaskApi.get(first).body(BLOCKS, contains(second, third));
  }
}
