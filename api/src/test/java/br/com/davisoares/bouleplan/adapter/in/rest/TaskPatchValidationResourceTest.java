package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskPatchValidationResourceTest {

  private static final String TITLE = "title";
  private static final String DESCRIPTION = "description";
  private static final String DEADLINE = "deadline";
  private static final String EFFORT = "estimatedEffort";
  private static final String EFFORT_INVALID = "task.effort.invalid";
  private static final String PRIORITY = "priority";
  private static final String STATUS = "status";
  private static final String BLOCKED = "isBlocked";
  private static final String WRITE = "Write";

  private String id;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    id = TaskApi.createId(TaskApi.initiativeId("Study"), WRITE);
  }

  private static void assertRule(String id, String json, String code) {
    InitiativeAssertions.assertProblem(TaskApi.patch(id, json), 400, code);
  }

  @Test
  @DisplayName("rule violations carry their codes and change nothing")
  void ruleViolations() {
    assertRule(id, "{\"title\": \" \"}", TaskApi.BLANK);
    assertRule(id, "{\"title\": \"" + "a".repeat(301) + "\"}", "task.title.too-long");
    assertRule(id, "{\"title\": \"a\\u0000b\"}", "task.title.invalid-characters");
    assertRule(
        id, "{\"description\": \"" + "a".repeat(10_001) + "\"}", "task.description.too-long");
    assertRule(id, "{\"description\": \"a\\u0000b\"}", "task.description.invalid-characters");
    assertRule(id, "{\"deadline\": \"+10000-01-01\"}", "task.deadline.invalid");
    assertRule(id, "{\"deadline\": \"0000-01-01\"}", "task.deadline.invalid");
    assertRule(id, "{\"estimatedEffort\": 0}", EFFORT_INVALID);
    assertRule(id, "{\"estimatedEffort\": -1}", EFFORT_INVALID);
    assertRule(id, "{\"estimatedEffort\": 999.01}", EFFORT_INVALID);
    assertRule(id, "{\"estimatedEffort\": 1.005}", EFFORT_INVALID);
    assertRule(id, "{\"estimatedEffort\": 1e400}", EFFORT_INVALID);

    TaskApi.get(id)
        .body(TITLE, equalTo(WRITE))
        .body(DESCRIPTION, nullValue())
        .body(DEADLINE, nullValue())
        .body(EFFORT, nullValue());
  }

  @Test
  @DisplayName("a rule violation applies none of the other fields of the same patch")
  void atomicPatch() {
    assertRule(id, "{\"priority\": \"P1\", \"estimatedEffort\": 0}", EFFORT_INVALID);

    TaskApi.get(id).body(PRIORITY, equalTo("P2"));
  }

  @Test
  @DisplayName("title, priority, status and isBlocked cannot be null")
  void nonNullableFields() {
    for (String field : new String[] {TITLE, PRIORITY, STATUS, BLOCKED}) {
      InitiativeAssertions.assertMalformed(TaskApi.patch(id, "{\"" + field + "\": null}"));
    }
    TaskApi.get(id).body(TITLE, equalTo(WRITE));
  }

  @Test
  @DisplayName("unknown enum values, other casings and wrong types are malformed")
  void wrongValues() {
    String[] bodies = {
      "{\"priority\": \"P4\"}",
      "{\"priority\": \"p1\"}",
      "{\"priority\": 1}",
      "{\"priority\": \"\"}",
      "{\"status\": \"blocked\"}",
      "{\"status\": \"DONE\"}",
      "{\"status\": \"todo\"}",
      "{\"status\": 0}",
      "{\"isBlocked\": \"true\"}",
      "{\"isBlocked\": 1}",
      "{\"title\": 1}",
      "{\"title\": []}",
      "{\"description\": {}}",
      "{\"description\": 5}",
      "{\"deadline\": 20261130}",
      "{\"deadline\": \"30/11/2026\"}",
      "{\"deadline\": \"2026-02-30\"}",
      "{\"estimatedEffort\": \"2\"}",
      "{\"estimatedEffort\": true}",
      "{\"estimatedEffort\": []}",
      "{\"estimatedEffort\": 1e99999999999}"
    };
    for (String body : bodies) {
      InitiativeAssertions.assertMalformed(TaskApi.patch(id, body));
    }
    TaskApi.get(id).body(PRIORITY, equalTo("P2")).body(STATUS, equalTo("to_do"));
  }

  @Test
  @DisplayName("unknown and read-only fields, non-objects and broken JSON are malformed")
  void unknownFields() {
    String[] bodies = {
      "{\"phaseId\": null}",
      "{\"plannedWeekStart\": \"2026-11-16\"}",
      "{\"id\": \"x\"}",
      "{\"archivedAt\": null}",
      "{\"origin\": \"native\"}",
      "{\"blocked\": true}",
      "{\"other\": 1}",
      "[]",
      "\"A\"",
      "null",
      "{",
      "{} x"
    };
    for (String body : bodies) {
      InitiativeAssertions.assertMalformed(TaskApi.patch(id, body));
    }
  }

  @Test
  @DisplayName("a duplicate key is malformed and changes nothing")
  void duplicateKeys() {
    InitiativeAssertions.assertMalformed(
        TaskApi.patch(id, "{\"priority\": \"P1\", \"priority\": \"P3\"}"));
    InitiativeAssertions.assertMalformed(
        TaskApi.patch(id, "{\"deadline\": null, \"deadline\": \"2026-11-30\"}"));

    TaskApi.get(id).body(PRIORITY, equalTo("P2")).body(DEADLINE, nullValue());
  }
}
