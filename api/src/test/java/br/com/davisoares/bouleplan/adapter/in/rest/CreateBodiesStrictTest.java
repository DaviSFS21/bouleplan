package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CreateBodiesStrictTest {

  private static final String[] BAD_BODIES = {
    "{\"name\": 1}",
    "{\"name\": true}",
    "{\"name\": {}}",
    "{\"name\": \"A\", \"color\": \"azul\"}",
    "{\"other\": \"A\"}",
    "[]",
    "\"A\"",
    "{\"name\": \"A\"} x",
    "{\"name\": 1e99999999999}"
  };

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
  }

  @Test
  @DisplayName("POST /initiatives rejects mistyped names, unknown fields and non-objects")
  void initiativeCreateIsStrict() {
    for (String body : BAD_BODIES) {
      InitiativeAssertions.assertMalformed(InitiativeApi.post(body));
    }
    InitiativeApi.list().body("size()", Matchers.is(1));
  }

  @Test
  @DisplayName("POST /initiatives with a null or missing name keeps the blank-name code")
  void initiativeBlankName() {
    InitiativeAssertions.assertProblem(
        InitiativeApi.post("{\"name\": null}"), 400, "initiative.name.blank");
    InitiativeAssertions.assertProblem(InitiativeApi.post("{}"), 400, "initiative.name.blank");
  }

  @Test
  @DisplayName(
      "POST /initiatives/{id}/epics rejects mistyped names, unknown fields and non-objects")
  void epicCreateIsStrict() {
    for (String body : BAD_BODIES) {
      InitiativeAssertions.assertMalformed(EpicApi.post(initiativeId, body));
    }
    EpicApi.list(initiativeId).body("", Matchers.empty());
  }

  @Test
  @DisplayName("POST /initiatives/{id}/epics with a null name keeps the blank-name code")
  void epicBlankName() {
    InitiativeAssertions.assertProblem(
        EpicApi.post(initiativeId, "{\"name\": null}"), 400, EpicApi.BLANK);
  }
}
