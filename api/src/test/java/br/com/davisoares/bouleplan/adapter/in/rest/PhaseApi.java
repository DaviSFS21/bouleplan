package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.ValidatableResponse;

/** Test helpers for the phase REST tests. */
final class PhaseApi {

  static final String PATH = "/phases";
  static final String NAME = "name";
  static final String BLANK = "phase.name.blank";
  static final String NEW_NAME = "{\"name\": \"New\"}";

  private PhaseApi() {}

  static String initiativeId(String name) {
    return InitiativeApi.idOf(InitiativeApi.create(name));
  }

  static String phasesPath(String initiativeId) {
    return InitiativeApi.PATH + "/" + initiativeId + PATH;
  }

  static ValidatableResponse post(String initiativeId, String json) {
    return given()
        .contentType(ContentType.JSON)
        .body(json)
        .when()
        .post(phasesPath(initiativeId))
        .then();
  }

  static String create(String initiativeId, String name) {
    return post(initiativeId, "{\"name\": \"" + name + "\"}").statusCode(201).extract().asString();
  }

  static String createId(String initiativeId, String name) {
    return JsonPath.from(create(initiativeId, name)).getString("id");
  }

  static ValidatableResponse list(String initiativeId) {
    return given().get(phasesPath(initiativeId)).then();
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
