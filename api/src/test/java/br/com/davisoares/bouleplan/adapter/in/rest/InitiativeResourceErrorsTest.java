package br.com.davisoares.bouleplan.adapter.in.rest;

import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.PATH;
import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.PROBLEM_JSON;
import static br.com.davisoares.bouleplan.adapter.in.rest.InitiativeApi.TYPE;
import static io.restassured.RestAssured.given;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativeResourceErrorsTest {

  private static final String INVALID = "/problems/invalid-initiative";
  private static final String MALFORMED = "/problems/malformed-request";

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("a blank name returns 400 invalid-initiative as problem+json")
  void blankNameIsInvalid() {
    InitiativeApi.post("{\"name\": \"   \"}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(INVALID))
        .body("title", Matchers.equalTo("Invalid initiative"))
        .body("status", Matchers.equalTo(400))
        .body("detail", Matchers.containsString("blank"));
  }

  @Test
  @DisplayName("a missing name returns 400 invalid-initiative")
  void missingNameIsInvalid() {
    InitiativeApi.post("{}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(INVALID));
  }

  @Test
  @DisplayName("malformed JSON returns 400 malformed-request")
  void malformedJson() {
    InitiativeApi.post("{\"name\": ")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(MALFORMED))
        .body("status", Matchers.equalTo(400));
  }

  @Test
  @DisplayName("a missing body returns 400 malformed-request")
  void missingBody() {
    given()
        .contentType(ContentType.JSON)
        .when()
        .post(PATH)
        .then()
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(MALFORMED));
  }

  @Test
  @DisplayName("a name of the wrong JSON type returns 400 malformed-request")
  void wrongNameType() {
    InitiativeApi.post("{\"name\": [1]}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(MALFORMED));
  }
}
