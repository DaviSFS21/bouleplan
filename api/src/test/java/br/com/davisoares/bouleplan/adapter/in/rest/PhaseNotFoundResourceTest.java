package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhaseNotFoundResourceTest {

  @Inject EntityManager entityManager;

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = PhaseApi.initiativeId("Study");
  }

  private static void assertEveryOperationNotFound(String phaseId) {
    InitiativeAssertions.assertNotFound(PhaseApi.get(phaseId));
    InitiativeAssertions.assertNotFound(PhaseApi.patch(phaseId, PhaseApi.NEW_NAME));
    InitiativeAssertions.assertNotFound(PhaseActions.archive(phaseId));
    InitiativeAssertions.assertNotFound(PhaseActions.unarchive(phaseId));
    InitiativeAssertions.assertNotFound(PhaseActions.delete(phaseId));
    InitiativeAssertions.assertNotFound(PhaseActions.restore(phaseId));
  }

  @Test
  @DisplayName("listing and creating on an unknown initiative are 404")
  void unknownInitiative() {
    String unknown = UUID.randomUUID().toString();

    InitiativeAssertions.assertNotFound(PhaseApi.list(unknown));
    InitiativeAssertions.assertNotFound(PhaseApi.post(unknown, PhaseApi.NEW_NAME));
  }

  @Test
  @DisplayName("an unknown phase is 404 for every operation")
  void unknownPhase() {
    assertEveryOperationNotFound(UUID.randomUUID().toString());
  }

  @Test
  @DisplayName("a phase of another user is 404 for every operation")
  void foreignPhase() {
    assertEveryOperationNotFound(TestData.insertForeignPhase(entityManager));
  }

  @Test
  @DisplayName("an implicit phase is never listed and cannot be touched over REST")
  void implicitPhaseIsHidden() {
    String implicit = TestData.insertImplicitPhase(initiativeId);
    PhaseApi.create(initiativeId, "Design");

    PhaseApi.list(initiativeId).body(PhaseApi.NAME, Matchers.contains("Design"));
    assertEveryOperationNotFound(implicit);
  }
}
