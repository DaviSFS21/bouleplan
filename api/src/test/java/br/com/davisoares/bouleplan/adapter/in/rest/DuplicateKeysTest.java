package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class DuplicateKeysTest {

  private static final String DUPLICATE = "{\"name\": \"a\", \"name\": \"b\"}";

  private String initiativeId;
  private String phaseId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = PhaseApi.initiativeId("Study");
    phaseId = PhaseApi.createId(initiativeId, "Design");
  }

  @Test
  @DisplayName("both POST endpoints reject a duplicate key")
  void postRejectsDuplicates() {
    InitiativeAssertions.assertMalformed(InitiativeApi.post(DUPLICATE));
    InitiativeAssertions.assertMalformed(PhaseApi.post(initiativeId, DUPLICATE));

    InitiativeApi.list().body("size()", Matchers.is(1));
    PhaseApi.list(initiativeId).body("size()", Matchers.is(1));
  }

  @Test
  @DisplayName("both PATCH endpoints reject a duplicate key and change nothing")
  void patchRejectsDuplicates() {
    InitiativeAssertions.assertMalformed(InitiativeApi.patch(initiativeId, DUPLICATE));
    InitiativeAssertions.assertMalformed(PhaseApi.patch(phaseId, DUPLICATE));

    InitiativeApi.get(initiativeId).body("name", Matchers.equalTo("Study"));
    PhaseApi.get(phaseId).body("name", Matchers.equalTo("Design"));
  }
}
