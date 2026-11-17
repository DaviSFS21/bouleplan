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

  private static final String RULE = "/problems/rule-violation";
  private static final String CODE = "code";
  private static final String MALFORMED = "/problems/malformed-request";

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("a blank name returns 400 rule-violation as problem+json")
  void blankNameIsInvalid() {
    InitiativeApi.post("{\"name\": \"   \"}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(RULE))
        .body(CODE, Matchers.equalTo("initiative.name.blank"))
        .body("title", Matchers.equalTo("Rule violation"))
        .body("status", Matchers.equalTo(400))
        .body("detail", Matchers.containsString("blank"));
  }

  @Test
  @DisplayName("a missing name returns 400 rule-violation")
  void missingNameIsInvalid() {
    InitiativeApi.post("{}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(RULE))
        .body(CODE, Matchers.equalTo("initiative.name.blank"));
  }

  @Test
  @DisplayName("malformed JSON returns 400 malformed-request")
  void malformedJson() {
    InitiativeApi.post("{\"name\": ")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(MALFORMED))
        .body(CODE, Matchers.equalTo("http.400"))
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
        .body(TYPE, Matchers.equalTo(MALFORMED))
        .body(CODE, Matchers.equalTo("http.400"));
  }

  @Test
  @DisplayName("a name of the wrong JSON type returns 400 malformed-request")
  void wrongNameType() {
    InitiativeApi.post("{\"name\": [1]}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(TYPE, Matchers.equalTo(MALFORMED))
        .body(CODE, Matchers.equalTo("http.400"));
  }

  @Test
  @DisplayName("an over-long name returns 400 with code initiative.name.too-long")
  void tooLongName() {
    InitiativeApi.post("{\"name\": \"" + "a".repeat(201) + "\"}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(CODE, Matchers.equalTo("initiative.name.too-long"));
  }

  @Test
  @DisplayName("a NUL character returns 400 with code initiative.name.invalid-characters")
  void nulCharacter() {
    InitiativeApi.post("{\"name\": \"a\\u0000b\"}")
        .statusCode(400)
        .contentType(PROBLEM_JSON)
        .body(CODE, Matchers.equalTo("initiative.name.invalid-characters"));
  }
}
