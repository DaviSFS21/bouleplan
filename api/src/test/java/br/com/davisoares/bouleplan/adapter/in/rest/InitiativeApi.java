package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.path.json.JsonPath;
import io.restassured.response.ValidatableResponse;

/** Test helpers shared by the REST tests. */
final class InitiativeApi {

  static final String PATH = "/initiatives";
  static final String NAME = "name";
  static final String COLOR = "color";
  static final String TYPE = "type";
  static final String NOT_FOUND = "http.404";
  static final String MALFORMED = "http.400";
  static final String PROBLEM_JSON = "application/problem+json";

  private InitiativeApi() {}

  static ValidatableResponse post(String json) {
    return given().contentType(ContentType.JSON).body(json).when().post(PATH).then();
  }

  static String create(String name) {
    return post("{\"name\": \"" + name + "\"}").statusCode(201).extract().asString();
  }

  static ValidatableResponse patch(String id, String json) {
    return patch(id, "application/merge-patch+json", json);
  }

  static ValidatableResponse patch(String id, String contentType, String json) {
    return given().contentType(contentType).body(json).when().patch(PATH + "/" + id).then();
  }

  static String idOf(String json) {
    return JsonPath.from(json).getString("id");
  }

  static ValidatableResponse get(String id) {
    return given().get(PATH + "/" + id).then();
  }

  static ValidatableResponse list() {
    return given().get(PATH).then().statusCode(200);
  }
}
