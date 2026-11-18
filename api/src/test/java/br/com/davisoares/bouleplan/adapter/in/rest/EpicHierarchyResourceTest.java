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
class EpicHierarchyResourceTest {

  private static final String NAME = "name";
  private static final String DESIGN = "Design";
  private static final String NEW_NAME = "{\"name\": \"New\"}";

  @Inject EntityManager entityManager;

  private String initiativeId;
  private String epicId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
    epicId = EpicApi.createId(initiativeId, DESIGN);
  }

  private void assertEpicUnreachable() {
    InitiativeAssertions.assertNotFound(EpicApi.list(initiativeId));
    InitiativeAssertions.assertNotFound(EpicApi.post(initiativeId, NEW_NAME));
    InitiativeAssertions.assertNotFound(EpicApi.get(epicId));
    InitiativeAssertions.assertNotFound(EpicApi.patch(epicId, NEW_NAME));
    InitiativeAssertions.assertNotFound(EpicActions.archive(epicId));
    InitiativeAssertions.assertNotFound(EpicActions.unarchive(epicId));
    InitiativeAssertions.assertNotFound(EpicActions.delete(epicId));
    InitiativeAssertions.assertNotFound(EpicActions.restore(epicId));
  }

  @Test
  @DisplayName("an archived initiative hides its epics and they return with it")
  void archivedInitiative() {
    InitiativeActions.archive(initiativeId).statusCode(200);

    assertEpicUnreachable();

    InitiativeActions.unarchive(initiativeId).statusCode(200);
    EpicApi.list(initiativeId).statusCode(200).body(NAME, contains(DESIGN));
    EpicApi.get(epicId).statusCode(200);
  }

  @Test
  @DisplayName("a deleted initiative hides its epics and they return when it is restored")
  void deletedInitiative() {
    InitiativeActions.delete(initiativeId).statusCode(204);

    assertEpicUnreachable();

    InitiativeActions.restore(initiativeId).statusCode(200);
    EpicApi.list(initiativeId).statusCode(200).body(NAME, contains(DESIGN));
  }

  @Test
  @DisplayName("archiving or deleting the initiative leaves the epic itself untouched")
  void epicKeepsItsState() {
    String archivedEpic = EpicApi.createId(initiativeId, "Archived");
    EpicActions.archive(archivedEpic).statusCode(200);
    InitiativeActions.archive(initiativeId).statusCode(200);
    InitiativeActions.unarchive(initiativeId).statusCode(200);

    EpicApi.list(initiativeId).body(NAME, contains(DESIGN));
    EpicActions.unarchive(archivedEpic).statusCode(200);
  }
}
