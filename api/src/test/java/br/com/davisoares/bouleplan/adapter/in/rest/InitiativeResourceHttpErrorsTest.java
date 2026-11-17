package br.com.davisoares.bouleplan.adapter.in.rest;

import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.PATH;
import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.PROBLEM_JSON;
import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.TYPE;
import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativeResourceHttpErrorsTest {

  private static final String CODE = "code";

  @Test
  @DisplayName("an unknown initiative returns 404 problem+json with code http.404")
  void unknownInitiative() {
    given()
        .when()
        .get(PATH + "/" + UUID.randomUUID())
        .then()
        .statusCode(404)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo("/problems/http-error"))
        .body(CODE, Matchers.equalTo("http.404"))
        .body("status", Matchers.equalTo(404));
  }

  @Test
  @DisplayName("a malformed initiative id returns 404 problem+json")
  void malformedId() {
    given()
        .when()
        .get(PATH + "/not-a-uuid")
        .then()
        .statusCode(404)
        .contentType(PROBLEM_JSON)
        .body(CODE, Matchers.equalTo("http.404"));
  }

  @Test
  @DisplayName("an unsupported method returns 405 problem+json with code http.405")
  void methodNotAllowed() {
    given()
        .when()
        .delete(PATH)
        .then()
        .statusCode(405)
        .contentType(PROBLEM_JSON)
        .body(CODE, Matchers.equalTo("http.405"));
  }
}
