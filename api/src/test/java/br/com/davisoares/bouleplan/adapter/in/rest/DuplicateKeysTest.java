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
  private String epicId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
    epicId = EpicApi.createId(initiativeId, "Design");
  }

  @Test
  @DisplayName("both POST endpoints reject a duplicate key")
  void postRejectsDuplicates() {
    InitiativeAssertions.assertMalformed(InitiativeApi.post(DUPLICATE));
    InitiativeAssertions.assertMalformed(EpicApi.post(initiativeId, DUPLICATE));

    InitiativeApi.list().body("size()", Matchers.is(1));
    EpicApi.list(initiativeId).body("size()", Matchers.is(1));
  }

  @Test
  @DisplayName("both PATCH endpoints reject a duplicate key and change nothing")
  void patchRejectsDuplicates() {
    InitiativeAssertions.assertMalformed(InitiativeApi.patch(initiativeId, DUPLICATE));
    InitiativeAssertions.assertMalformed(EpicApi.patch(epicId, DUPLICATE));

    InitiativeApi.get(initiativeId).body("name", Matchers.equalTo("Study"));
    EpicApi.get(epicId).body("name", Matchers.equalTo("Design"));
  }
}
