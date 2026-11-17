package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class InitiativePatchDeadlineColorTest {

  private static final String DEADLINE = "overallDeadline";
  private static final String COLOR = "color";
  private static final String OTHER_NAME = "{\"name\": \"X\"}";

  private String id;

  @BeforeEach
  void setUp() {
    TestData.deleteAllInitiatives();
    id = InitiativeApi.idOf(InitiativeApi.create("Keep"));
  }

  @Test
  @DisplayName("overallDeadline: value sets, null clears, absent keeps")
  void deadlineSemantics() {
    InitiativeApi.patch(id, "{\"overallDeadline\": \"2028-12-31\"}")
        .statusCode(200)
        .body(DEADLINE, Matchers.equalTo("2028-12-31"));
    InitiativeApi.patch(id, OTHER_NAME).body(DEADLINE, Matchers.equalTo("2028-12-31"));
    InitiativeApi.patch(id, "{\"overallDeadline\": null}")
        .statusCode(200)
        .body(DEADLINE, Matchers.nullValue());
  }

  @Test
  @DisplayName("overallDeadline: a malformed date is a malformed request")
  void deadlineMalformed() {
    InitiativeAssertions.assertMalformed(
        InitiativeApi.patch(id, "{\"overallDeadline\": \"31/12/2028\"}"));
    InitiativeAssertions.assertMalformed(
        InitiativeApi.patch(id, "{\"overallDeadline\": 20281231}"));
  }

  @Test
  @DisplayName("color: a token recolors, absent keeps")
  void colorSemantics() {
    InitiativeApi.patch(id, "{\"color\": \"roxo\"}")
        .statusCode(200)
        .body(COLOR, Matchers.equalTo("roxo"));
    InitiativeApi.patch(id, OTHER_NAME).body(COLOR, Matchers.equalTo("roxo"));
  }

  @Test
  @DisplayName("color: null and unknown tokens are rejected")
  void colorErrors() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"color\": null}"), 400, "initiative.color.required");
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"color\": \"AZUL\"}"), 400, "initiative.color.invalid");
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"color\": \"\"}"), 400, "initiative.color.invalid");
  }

  @Test
  @DisplayName("a repeated color is allowed")
  void repeatedColor() {
    InitiativeApi.create("Second");

    InitiativeApi.patch(id, "{\"color\": \"lima\"}")
        .statusCode(200)
        .body(COLOR, Matchers.equalTo("lima"));
  }

  @Test
  @DisplayName("a failing field leaves the whole patch unapplied")
  void atomic() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.patch(id, "{\"name\": \"Changed\", \"color\": \"nope\"}"),
        400,
        "initiative.color.invalid");

    InitiativeApi.get(id).body("name", Matchers.equalTo("Keep"));
  }
}
