package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.http.ContentType;
import io.restassured.response.ValidatableResponse;

/** Test helpers shared by the REST tests. */
final class InitiativeApi {

  static final String PATH = "/initiatives";
  static final String NAME = "name";
  static final String COLOR = "color";
  static final String TYPE = "type";
  static final String PROBLEM_JSON = "application/problem+json";

  private InitiativeApi() {}

  static ValidatableResponse post(String json) {
    return given().contentType(ContentType.JSON).body(json).when().post(PATH).then();
  }

  static String create(String name) {
    return post("{\"name\": \"" + name + "\"}").statusCode(201).extract().asString();
  }
}
