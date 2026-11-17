package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhaseHierarchyResourceTest {

  private static final String NAME = "name";
  private static final String DESIGN = "Design";
  private static final String NEW_NAME = "{\"name\": \"New\"}";

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String phaseId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = PhaseApi.initiativeId("Study");
    phaseId = PhaseApi.createId(initiativeId, DESIGN);
  }

  private void assertPhaseUnreachable() {
    InitiativeAssertions.assertNotFound(PhaseApi.list(initiativeId));
    InitiativeAssertions.assertNotFound(PhaseApi.post(initiativeId, NEW_NAME));
    InitiativeAssertions.assertNotFound(PhaseApi.get(phaseId));
    InitiativeAssertions.assertNotFound(PhaseApi.patch(phaseId, NEW_NAME));
    InitiativeAssertions.assertNotFound(PhaseActions.archive(phaseId));
    InitiativeAssertions.assertNotFound(PhaseActions.unarchive(phaseId));
    InitiativeAssertions.assertNotFound(PhaseActions.delete(phaseId));
    InitiativeAssertions.assertNotFound(PhaseActions.restore(phaseId));
  }

  @Test
  @DisplayName("an archived initiative hides its phases and they return with it")
  void archivedInitiative() {
    InitiativeActions.archive(initiativeId).statusCode(200);

    assertPhaseUnreachable();

    InitiativeActions.unarchive(initiativeId).statusCode(200);
    PhaseApi.list(initiativeId).statusCode(200).body(NAME, contains(DESIGN));
    PhaseApi.get(phaseId).statusCode(200);
  }

  @Test
  @DisplayName("a deleted initiative hides its phases and they return when it is restored")
  void deletedInitiative() {
    InitiativeActions.delete(initiativeId).statusCode(204);

    assertPhaseUnreachable();

    InitiativeActions.restore(initiativeId).statusCode(200);
    PhaseApi.list(initiativeId).statusCode(200).body(NAME, contains(DESIGN));
  }

  @Test
  @DisplayName("archiving or deleting the initiative leaves the phase itself untouched")
  void phaseKeepsItsState() {
    String archivedPhase = PhaseApi.createId(initiativeId, "Archived");
    PhaseActions.archive(archivedPhase).statusCode(200);
    InitiativeActions.archive(initiativeId).statusCode(200);
    InitiativeActions.unarchive(initiativeId).statusCode(200);

    PhaseApi.list(initiativeId).body(NAME, contains(DESIGN));
    PhaseActions.unarchive(archivedPhase).statusCode(200);
  }
}
