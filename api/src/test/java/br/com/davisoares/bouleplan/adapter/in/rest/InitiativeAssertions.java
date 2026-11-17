package br.com.davisoares.bouleplan.adapter.in.rest;

import io.restassured.response.ValidatableResponse;
import org.hamcrest.Matchers;

/** Response assertions shared by the REST tests. */
final class InitiativeAssertions {

  private InitiativeAssertions() {}

  static void assertProblem(ValidatableResponse response, int status, String code) {
    response
        .statusCode(status)
        .contentType(InitiativeApi.PROBLEM_JSON)
        .body("code", Matchers.equalTo(code));
  }

  static void assertNotFound(ValidatableResponse response) {
    assertProblem(response, 404, InitiativeApi.NOT_FOUND);
  }

  static void assertMalformed(ValidatableResponse response) {
    assertProblem(response, 400, InitiativeApi.MALFORMED);
  }

  static void assertListed(String... names) {
    InitiativeApi.list()
        .body(InitiativeApi.NAME, names.length == 0 ? Matchers.empty() : Matchers.contains(names));
  }
}
