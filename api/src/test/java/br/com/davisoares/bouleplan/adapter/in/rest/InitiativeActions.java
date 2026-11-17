package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.response.ValidatableResponse;

/** Lifecycle calls shared by the REST tests. */
final class InitiativeActions {

  private InitiativeActions() {}

  static ValidatableResponse action(String method, String id, String suffix) {
    return given().when().request(method, InitiativeApi.PATH + "/" + id + suffix).then();
  }

  static ValidatableResponse archive(String id) {
    return action("POST", id, "/archive");
  }

  static ValidatableResponse unarchive(String id) {
    return action("POST", id, "/unarchive");
  }

  static ValidatableResponse restore(String id) {
    return action("POST", id, "/restore");
  }

  static ValidatableResponse delete(String id) {
    return action("DELETE", id, "");
  }
}
