package br.com.davisoares.bouleplan.adapter.in.rest;

import static io.restassured.RestAssured.given;

import io.restassured.response.ValidatableResponse;

/** Test helpers for the blocker REST tests. */
final class TaskBlockerApi {

  private TaskBlockerApi() {}

  static String path(String blockingId, String blockedId) {
    return TaskApi.PATH + "/" + blockingId + "/blocks/" + blockedId;
  }

  static ValidatableResponse block(String blockingId, String blockedId) {
    return given().when().put(path(blockingId, blockedId)).then();
  }

  static ValidatableResponse unblock(String blockingId, String blockedId) {
    return given().when().delete(path(blockingId, blockedId)).then();
  }
}
