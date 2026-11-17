package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.response.ValidatableResponse;

/** Lifecycle calls for the task REST tests. */
final class TaskActions {

  private TaskActions() {}

  static ValidatableResponse action(String method, String id, String suffix) {
    return given().when().request(method, TaskApi.PATH + "/" + id + suffix).then();
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
