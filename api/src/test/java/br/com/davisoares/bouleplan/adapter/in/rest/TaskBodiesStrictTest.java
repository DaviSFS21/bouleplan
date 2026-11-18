package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskBodiesStrictTest {

  private static final String[] BAD_BODIES = {
    "{\"title\": 1}",
    "{\"title\": true}",
    "{\"title\": {}}",
    "{\"title\": \"A\", \"priority\": \"P1\"}",
    "{\"title\": \"A\", \"deadline\": \"2026-11-30\"}",
    "{\"title\": \"A\", \"isBlocked\": true}",
    "{\"title\": \"A\", \"initiativeId\": \"x\"}",
    "{\"title\": \"A\", \"epicId\": 1}",
    "{\"title\": \"A\", \"epicId\": \"not-a-uuid\"}",
    "{\"title\": \"A\", \"epicId\": \"\"}",
    "{\"title\": \"A\", \"epicId\": {}}",
    "{\"title\": \"A\", \"status\": null}",
    "{\"title\": \"A\", \"status\": \"started\"}",
    "{\"title\": \"A\", \"status\": \"DONE\"}",
    "{\"title\": \"A\", \"status\": 1}",
    "{\"other\": \"A\"}",
    "{\"title\": \"A\", \"title\": \"B\"}",
    "[]",
    "\"A\"",
    "null",
    "{\"title\": \"A\"} x"
  };

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = TaskApi.initiativeId("Study");
  }

  @Test
  @DisplayName("POST /initiatives/{id}/tasks rejects bad types, unknown fields and non-objects")
  void createIsStrict() {
    for (String body : BAD_BODIES) {
      InitiativeAssertions.assertMalformed(TaskApi.post(initiativeId, body));
    }
    TaskApi.list().body("", Matchers.empty());
  }

  @Test
  @DisplayName("a null or missing title keeps the blank-title code")
  void blankTitle() {
    InitiativeAssertions.assertProblem(
        TaskApi.post(initiativeId, "{\"title\": null}"), 400, TaskApi.BLANK);
    InitiativeAssertions.assertProblem(TaskApi.post(initiativeId, "{}"), 400, TaskApi.BLANK);
    InitiativeAssertions.assertProblem(
        TaskApi.post(initiativeId, "{\"title\": \"  \"}"), 400, TaskApi.BLANK);
  }

  @Test
  @DisplayName("long and invalid titles are rejected on create with their codes")
  void invalidTitles() {
    InitiativeAssertions.assertProblem(
        TaskApi.post(initiativeId, "{\"title\": \"" + "a".repeat(301) + "\"}"),
        400,
        "task.title.too-long");
    InitiativeAssertions.assertProblem(
        TaskApi.post(initiativeId, "{\"title\": \"a\\u0000b\"}"),
        400,
        "task.title.invalid-characters");
    TaskApi.list().body("", Matchers.empty());
  }

  @Test
  @DisplayName("a create without a body is a malformed request")
  void missingBody() {
    InitiativeAssertions.assertMalformed(
        RestAssured.given()
            .contentType("application/json")
            .when()
            .post(TaskApi.tasksPath(initiativeId))
            .then());
  }

  @Test
  @DisplayName("a create with an unsupported content type is 415")
  void wrongContentType() {
    InitiativeAssertions.assertProblem(
        RestAssured.given()
            .contentType("text/plain")
            .body(TaskApi.NEW_TITLE)
            .when()
            .post(TaskApi.tasksPath(initiativeId))
            .then(),
        415,
        "http.415");
  }
}
