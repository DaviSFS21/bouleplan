package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskBlockerCycleResourceTest {

  private static final String BLOCKS = "blocks";
  private static final String BLOCKED_BY = "blockedBy";
  private static final String SELF = "task.blocker.self";
  private static final String CYCLE = "task.blocker.cycle";

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
  @DisplayName("a task cannot block itself")
  void selfLink() {
    InitiativeAssertions.assertProblem(TaskBlockerApi.block(first, first), 422, SELF);
  }

  @Test
  @DisplayName("a direct opposite link would close a cycle")
  void directCycle() {
    TaskBlockerApi.block(first, second).statusCode(204);

    InitiativeAssertions.assertProblem(TaskBlockerApi.block(second, first), 422, CYCLE);

    TaskApi.get(second).body(BLOCKS, empty());
  }

  @Test
  @DisplayName("a transitive path would close a cycle")
  void transitiveCycle() {
    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(second, third).statusCode(204);

    InitiativeAssertions.assertProblem(TaskBlockerApi.block(third, first), 422, CYCLE);

    TaskApi.get(third).body(BLOCKS, empty());
  }

  @Test
  @DisplayName("a diamond is not a cycle")
  void diamond() {
    String d = TaskApi.createId(initiativeId, "D");

    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(first, third).statusCode(204);
    TaskBlockerApi.block(second, d).statusCode(204);
    TaskBlockerApi.block(third, d).statusCode(204);

    TaskApi.get(d).body(BLOCKED_BY, contains(second, third));
  }

  @Test
  @DisplayName("removing a link in the path allows the opposite one")
  void cycleAfterRemoval() {
    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(second, third).statusCode(204);
    TaskBlockerApi.unblock(first, second).statusCode(204);

    TaskBlockerApi.block(third, first).statusCode(204);
  }

  @Test
  @DisplayName("a cycle is detected through a hidden task")
  void cycleThroughHiddenTask() {
    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(second, third).statusCode(204);
    TaskActions.archive(second).statusCode(200);

    InitiativeAssertions.assertProblem(TaskBlockerApi.block(third, first), 422, CYCLE);

    TaskActions.unarchive(second).statusCode(200);
    TaskApi.get(third).body(BLOCKS, empty());
  }

  @Test
  @DisplayName("a cycle is detected through a task in an archived epic or initiative")
  void cycleThroughHiddenParents() {
    String epic = EpicApi.createId(initiativeId, "Design");
    String inEpic = TaskApi.createIdInEpic(initiativeId, "In epic", epic);
    TaskBlockerApi.block(first, inEpic).statusCode(204);
    TaskBlockerApi.block(inEpic, second).statusCode(204);
    EpicActions.archive(epic).statusCode(200);

    InitiativeAssertions.assertProblem(TaskBlockerApi.block(second, first), 422, CYCLE);
  }
}
