package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class EpicResourceErrorsTest {

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
  }

  @Test
  @DisplayName("blank, long and invalid names are rejected on create with their codes")
  void invalidNames() {
    InitiativeAssertions.assertProblem(
        EpicApi.post(initiativeId, "{\"name\": \"  \"}"), 400, EpicApi.BLANK);
    InitiativeAssertions.assertProblem(EpicApi.post(initiativeId, "{}"), 400, EpicApi.BLANK);
    InitiativeAssertions.assertProblem(
        EpicApi.post(initiativeId, "{\"name\": \"" + "a".repeat(201) + "\"}"),
        400,
        "epic.name.too-long");
    InitiativeAssertions.assertProblem(
        EpicApi.post(initiativeId, "{\"name\": \"a\\u0000b\"}"),
        400,
        "epic.name.invalid-characters");
    EpicApi.list(initiativeId).body("", Matchers.empty());
  }

  @Test
  @DisplayName("a create without a body is a malformed request")
  void missingBody() {
    InitiativeAssertions.assertMalformed(
        RestAssured.given()
            .contentType("application/json")
            .when()
            .post(EpicApi.epicsPath(initiativeId))
            .then());
  }

  @Test
  @DisplayName("patch rejects a blank, null or mistyped name and unknown fields")
  void invalidPatch() {
    String id = EpicApi.createId(initiativeId, "Design");

    InitiativeAssertions.assertProblem(EpicApi.patch(id, "{\"name\": \" \"}"), 400, EpicApi.BLANK);
    InitiativeAssertions.assertProblem(EpicApi.patch(id, "{\"name\": null}"), 400, EpicApi.BLANK);
    InitiativeAssertions.assertMalformed(EpicApi.patch(id, "{\"name\": []}"));
    InitiativeAssertions.assertMalformed(EpicApi.patch(id, "{\"color\": \"azul\"}"));
    InitiativeAssertions.assertMalformed(EpicApi.patch(id, "[]"));
    InitiativeAssertions.assertMalformed(EpicApi.patch(id, "{"));
    EpicApi.get(id).body(EpicApi.NAME, Matchers.equalTo("Design"));
  }
}
