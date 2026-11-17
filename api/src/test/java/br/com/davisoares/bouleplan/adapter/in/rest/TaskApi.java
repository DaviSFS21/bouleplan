package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.ValidatableResponse;

/** Test helpers for the task REST tests. */
final class TaskApi {

  static final String PATH = "/tasks";
  static final String TITLE = "title";
  static final String BLANK = "task.title.blank";
  static final String NEW_TITLE = "{\"title\": \"New\"}";

  private TaskApi() {}

  static String initiativeId(String name) {
    return InitiativeApi.idOf(InitiativeApi.create(name));
  }

  static String tasksPath(String initiativeId) {
    return InitiativeApi.PATH + "/" + initiativeId + PATH;
  }

  static ValidatableResponse post(String initiativeId, String json) {
    return given()
        .contentType(ContentType.JSON)
        .body(json)
        .when()
        .post(tasksPath(initiativeId))
        .then();
  }

  static String create(String initiativeId, String title) {
    return post(initiativeId, "{\"title\": \"" + title + "\"}")
        .statusCode(201)
        .extract()
        .asString();
  }

  static String createId(String initiativeId, String title) {
    return JsonPath.from(create(initiativeId, title)).getString("id");
  }

  static String createIdInPhase(String initiativeId, String title, String phaseId) {
    return post(initiativeId, "{\"title\": \"" + title + "\", \"phaseId\": \"" + phaseId + "\"}")
        .statusCode(201)
        .extract()
        .path("id");
  }

  static ValidatableResponse list() {
    return given().get(PATH).then();
  }

  static ValidatableResponse get(String id) {
    return given().get(PATH + "/" + id).then();
  }

  static ValidatableResponse patch(String id, String json) {
    return given()
        .contentType("application/merge-patch+json")
        .body(json)
        .when()
        .patch(PATH + "/" + id)
        .then();
  }
}
