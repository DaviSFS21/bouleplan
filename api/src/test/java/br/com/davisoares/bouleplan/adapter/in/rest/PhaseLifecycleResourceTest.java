package br.com.davisoares.bouleplan.adapter.in.rest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;

import br.com.davisoares.bouleplan.TestData;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhaseLifecycleResourceTest {

  private static final String NAME = "name";
  private static final String DESIGN = "Design";

  private String initiativeId;
  private String id;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = PhaseApi.initiativeId("Study");
    id = PhaseApi.createId(initiativeId, DESIGN);
  }

  @Test
  @DisplayName("archive returns the phase and hides it; archiving again is 404")
  void archive() {
    PhaseActions.archive(id).statusCode(200).body(NAME, equalTo(DESIGN));

    PhaseApi.list(initiativeId).body("", empty());
    InitiativeAssertions.assertNotFound(PhaseApi.get(id));
    InitiativeAssertions.assertNotFound(PhaseActions.archive(id));
    InitiativeAssertions.assertNotFound(PhaseApi.patch(id, "{\"name\": \"x\"}"));
    InitiativeAssertions.assertNotFound(PhaseActions.delete(id));
  }

  @Test
  @DisplayName("unarchive brings the phase back; on an active phase it is a no-op")
  void unarchive() {
    PhaseActions.unarchive(id).statusCode(200).body(NAME, equalTo(DESIGN));
    PhaseActions.archive(id).statusCode(200);

    PhaseActions.unarchive(id).statusCode(200).body(NAME, equalTo(DESIGN));

    PhaseApi.list(initiativeId).body(NAME, contains(DESIGN));
  }

  @Test
  @DisplayName("delete is 204 and hides the phase; deleting again is 404")
  void delete() {
    PhaseActions.delete(id).statusCode(204);

    PhaseApi.list(initiativeId).body("", empty());
    InitiativeAssertions.assertNotFound(PhaseApi.get(id));
    InitiativeAssertions.assertNotFound(PhaseActions.delete(id));
    InitiativeAssertions.assertNotFound(PhaseActions.archive(id));
    InitiativeAssertions.assertNotFound(PhaseActions.unarchive(id));
  }

  @Test
  @DisplayName("restore brings a deleted phase back; on a phase that is not deleted it is a no-op")
  void restore() {
    PhaseActions.restore(id).statusCode(200).body(NAME, equalTo(DESIGN));
    PhaseActions.delete(id).statusCode(204);

    PhaseActions.restore(id).statusCode(200).body(NAME, equalTo(DESIGN));

    PhaseApi.list(initiativeId).body(NAME, contains(DESIGN));
  }

  @Test
  @DisplayName("an archived phase can be deleted only after unarchiving")
  void archivedThenDelete() {
    PhaseActions.archive(id).statusCode(200);

    InitiativeAssertions.assertNotFound(PhaseActions.delete(id));
    PhaseActions.unarchive(id).statusCode(200);
    PhaseActions.delete(id).statusCode(204);
  }

  @Test
  @DisplayName("restoring a deleted phase keeps it in its creation position")
  void restoreKeepsOrder() {
    String second = PhaseApi.createId(initiativeId, "Second");
    PhaseActions.delete(id).statusCode(204);
    PhaseActions.restore(id).statusCode(200);

    PhaseApi.list(initiativeId).body(NAME, contains(DESIGN, "Second"));
    PhaseApi.get(second).statusCode(200);
  }

  @Test
  @DisplayName("unarchive of a deleted phase is 404")
  void unarchiveDeleted() {
    PhaseActions.delete(id).statusCode(204);

    InitiativeAssertions.assertNotFound(PhaseActions.unarchive(id));
  }
}
