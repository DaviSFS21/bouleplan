package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhaseResourceErrorsTest {

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = PhaseApi.initiativeId("Study");
  }

  @Test
  @DisplayName("blank, long and invalid names are rejected on create with their codes")
  void invalidNames() {
    InitiativeAssertions.assertProblem(
        PhaseApi.post(initiativeId, "{\"name\": \"  \"}"), 400, PhaseApi.BLANK);
    InitiativeAssertions.assertProblem(PhaseApi.post(initiativeId, "{}"), 400, PhaseApi.BLANK);
    InitiativeAssertions.assertProblem(
        PhaseApi.post(initiativeId, "{\"name\": \"" + "a".repeat(201) + "\"}"),
        400,
        "phase.name.too-long");
    InitiativeAssertions.assertProblem(
        PhaseApi.post(initiativeId, "{\"name\": \"a\\u0000b\"}"),
        400,
        "phase.name.invalid-characters");
    PhaseApi.list(initiativeId).body("", Matchers.empty());
  }

  @Test
  @DisplayName("a create without a body is a malformed request")
  void missingBody() {
    InitiativeAssertions.assertMalformed(
        RestAssured.given()
            .contentType("application/json")
            .when()
            .post(PhaseApi.phasesPath(initiativeId))
            .then());
  }

  @Test
  @DisplayName("patch rejects a blank, null or mistyped name and unknown fields")
  void invalidPatch() {
    String id = PhaseApi.createId(initiativeId, "Design");

    InitiativeAssertions.assertProblem(
        PhaseApi.patch(id, "{\"name\": \" \"}"), 400, PhaseApi.BLANK);
    InitiativeAssertions.assertProblem(PhaseApi.patch(id, "{\"name\": null}"), 400, PhaseApi.BLANK);
    InitiativeAssertions.assertMalformed(PhaseApi.patch(id, "{\"name\": []}"));
    InitiativeAssertions.assertMalformed(PhaseApi.patch(id, "{\"color\": \"azul\"}"));
    InitiativeAssertions.assertMalformed(PhaseApi.patch(id, "[]"));
    InitiativeAssertions.assertMalformed(PhaseApi.patch(id, "{"));
    PhaseApi.get(id).body(PhaseApi.NAME, Matchers.equalTo("Design"));
  }
}
