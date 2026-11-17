package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskBlockerResourceTest {

  private static final String BLOCKS = "blocks";
  private static final String BLOCKED_BY = "blockedBy";

  private String first;
  private String second;
  private String third;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    String initiativeId = TaskApi.initiativeId("Study");
    first = TaskApi.createId(initiativeId, "A");
    second = TaskApi.createId(initiativeId, "B");
    third = TaskApi.createId(initiativeId, "C");
  }

  @Test
  @DisplayName("PUT links two tasks and both sides show it")
  void put() {
    TaskBlockerApi.block(first, second).statusCode(204);

    TaskApi.get(first).body(BLOCKS, contains(second)).body(BLOCKED_BY, empty());
    TaskApi.get(second).body(BLOCKS, empty()).body(BLOCKED_BY, contains(first));
    TaskApi.get(third).body(BLOCKS, empty()).body(BLOCKED_BY, empty());
  }

  @Test
  @DisplayName("PUT is idempotent")
  void putTwice() {
    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(first, second).statusCode(204);

    TaskApi.get(first).body(BLOCKS, contains(second));
  }

  @Test
  @DisplayName("DELETE unlinks and is idempotent, also when the link never existed")
  void delete() {
    TaskBlockerApi.block(first, second).statusCode(204);

    TaskBlockerApi.unblock(first, second).statusCode(204);
    TaskBlockerApi.unblock(first, second).statusCode(204);
    TaskBlockerApi.unblock(second, first).statusCode(204);
    TaskBlockerApi.unblock(first, third).statusCode(204);

    TaskApi.get(first).body(BLOCKS, empty());
    TaskApi.get(second).body(BLOCKED_BY, empty());
  }

  @Test
  @DisplayName("unlinking one pair leaves the other links")
  void deleteKeepsOthers() {
    TaskBlockerApi.block(first, second).statusCode(204);
    TaskBlockerApi.block(first, third).statusCode(204);
    TaskBlockerApi.block(second, third).statusCode(204);

    TaskBlockerApi.unblock(first, second).statusCode(204);

    TaskApi.get(first).body(BLOCKS, contains(third));
    TaskApi.get(third).body(BLOCKED_BY, contains(first, second));
  }

  @Test
  @DisplayName("tasks of different initiatives can block each other")
  void acrossInitiatives() {
    String other = TaskApi.createId(TaskApi.initiativeId("Other"), "Elsewhere");

    TaskBlockerApi.block(first, other).statusCode(204);

    TaskApi.get(other).body(BLOCKED_BY, contains(first));
  }
}
