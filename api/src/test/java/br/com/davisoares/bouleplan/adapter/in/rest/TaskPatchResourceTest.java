package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskPatchResourceTest {

  private static final String TITLE = "title";
  private static final String DESCRIPTION = "description";
  private static final String DEADLINE = "deadline";
  private static final String EFFORT = "estimatedEffort";
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

  @Test
  @DisplayName("an empty patch changes nothing")
  void emptyPatch() {
    TaskApi.patch(id, "{}")
        .statusCode(200)
        .body(TITLE, equalTo(WRITE))
        .body(PRIORITY, equalTo("P2"))
        .body(STATUS, equalTo("to_do"));
  }

  @Test
  @DisplayName("every field is patched on its own and the others stay")
  void everyField() {
    TaskApi.patch(id, "{\"title\": \" New \"}").statusCode(200).body(TITLE, equalTo("New"));
    TaskApi.patch(id, "{\"description\": \"a\\r\\nb\"}")
        .statusCode(200)
        .body(DESCRIPTION, equalTo("a\nb"))
        .body(TITLE, equalTo("New"));
    TaskApi.patch(id, "{\"deadline\": \"2026-11-30\"}")
        .statusCode(200)
        .body(DEADLINE, equalTo("2026-11-30"))
        .body(DESCRIPTION, equalTo("a\nb"));
    TaskApi.patch(id, "{\"estimatedEffort\": 2.5}")
        .statusCode(200)
        .body(EFFORT, equalTo(2.5f))
        .body(DEADLINE, equalTo("2026-11-30"));
    TaskApi.patch(id, "{\"priority\": \"P1\"}")
        .statusCode(200)
        .body(PRIORITY, equalTo("P1"))
        .body(EFFORT, equalTo(2.5f));
    TaskApi.patch(id, "{\"status\": \"in_progress\"}")
        .statusCode(200)
        .body(STATUS, equalTo("in_progress"))
        .body(PRIORITY, equalTo("P1"));
    TaskApi.patch(id, "{\"isBlocked\": true}")
        .statusCode(200)
        .body(BLOCKED, equalTo(true))
        .body(STATUS, equalTo("in_progress"));
    TaskApi.get(id)
        .body(TITLE, equalTo("New"))
        .body(DESCRIPTION, equalTo("a\nb"))
        .body(DEADLINE, equalTo("2026-11-30"))
        .body(EFFORT, equalTo(2.5f))
        .body(PRIORITY, equalTo("P1"))
        .body(STATUS, equalTo("in_progress"))
        .body(BLOCKED, equalTo(true));
  }

  @Test
  @DisplayName("null clears description, deadline and estimated effort")
  void nullClears() {
    TaskApi.patch(
            id, "{\"description\": \"d\", \"deadline\": \"2026-11-30\", \"estimatedEffort\": 3}")
        .statusCode(200);

    TaskApi.patch(id, "{\"description\": null, \"deadline\": null, \"estimatedEffort\": null}")
        .statusCode(200)
        .body(DESCRIPTION, nullValue())
        .body(DEADLINE, nullValue())
        .body(EFFORT, nullValue())
        .body(TITLE, equalTo(WRITE));
  }

  @Test
  @DisplayName("a blank description clears it; whole numbers and two decimals are accepted")
  void blankDescriptionAndEffortFormats() {
    TaskApi.patch(id, "{\"description\": \"d\"}").statusCode(200);
    TaskApi.patch(id, "{\"description\": \"  \"}").body(DESCRIPTION, nullValue());
    TaskApi.patch(id, "{\"estimatedEffort\": 8}").statusCode(200).body(EFFORT, equalTo(8.0f));
    TaskApi.patch(id, "{\"estimatedEffort\": 0.25}").statusCode(200).body(EFFORT, equalTo(0.25f));
    TaskApi.patch(id, "{\"estimatedEffort\": 999.99e0}").statusCode(400);
    TaskApi.patch(id, "{\"estimatedEffort\": 999}").statusCode(200);
  }

  @Test
  @DisplayName("the plain application/json content type is a patch too")
  void plainJson() {
    RestAssured.given()
        .contentType("application/json")
        .body("{\"priority\": \"P3\"}")
        .when()
        .patch("/tasks/" + id)
        .then()
        .statusCode(200)
        .body(PRIORITY, equalTo("P3"));
  }

  @Test
  @DisplayName("blocking is independent of the status")
  void blockedIndependentOfStatus() {
    TaskApi.patch(id, "{\"isBlocked\": true, \"status\": \"done\"}")
        .statusCode(200)
        .body(BLOCKED, equalTo(true))
        .body(STATUS, equalTo("done"));
    TaskApi.patch(id, "{\"isBlocked\": false}")
        .statusCode(200)
        .body(BLOCKED, equalTo(false))
        .body(STATUS, equalTo("done"));
  }
}
