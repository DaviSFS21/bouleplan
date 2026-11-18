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
class EpicLifecycleResourceTest {

  private static final String NAME = "name";
  private static final String DESIGN = "Design";

  private String initiativeId;
  private String id;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
    id = EpicApi.createId(initiativeId, DESIGN);
  }

  @Test
  @DisplayName("archive returns the epic and hides it; archiving again is 404")
  void archive() {
    EpicActions.archive(id).statusCode(200).body(NAME, equalTo(DESIGN));

    EpicApi.list(initiativeId).body("", empty());
    InitiativeAssertions.assertNotFound(EpicApi.get(id));
    InitiativeAssertions.assertNotFound(EpicActions.archive(id));
    InitiativeAssertions.assertNotFound(EpicApi.patch(id, "{\"name\": \"x\"}"));
    InitiativeAssertions.assertNotFound(EpicActions.delete(id));
  }

  @Test
  @DisplayName("unarchive brings the epic back; on an active epic it is a no-op")
  void unarchive() {
    EpicActions.unarchive(id).statusCode(200).body(NAME, equalTo(DESIGN));
    EpicActions.archive(id).statusCode(200);

    EpicActions.unarchive(id).statusCode(200).body(NAME, equalTo(DESIGN));

    EpicApi.list(initiativeId).body(NAME, contains(DESIGN));
  }

  @Test
  @DisplayName("delete is 204 and hides the epic; deleting again is 404")
  void delete() {
    EpicActions.delete(id).statusCode(204);

    EpicApi.list(initiativeId).body("", empty());
    InitiativeAssertions.assertNotFound(EpicApi.get(id));
    InitiativeAssertions.assertNotFound(EpicActions.delete(id));
    InitiativeAssertions.assertNotFound(EpicActions.archive(id));
    InitiativeAssertions.assertNotFound(EpicActions.unarchive(id));
  }

  @Test
  @DisplayName("restore brings a deleted epic back; on an epic that is not deleted it is a no-op")
  void restore() {
    EpicActions.restore(id).statusCode(200).body(NAME, equalTo(DESIGN));
    EpicActions.delete(id).statusCode(204);

    EpicActions.restore(id).statusCode(200).body(NAME, equalTo(DESIGN));

    EpicApi.list(initiativeId).body(NAME, contains(DESIGN));
  }

  @Test
  @DisplayName("an archived epic can be deleted only after unarchiving")
  void archivedThenDelete() {
    EpicActions.archive(id).statusCode(200);

    InitiativeAssertions.assertNotFound(EpicActions.delete(id));
    EpicActions.unarchive(id).statusCode(200);
    EpicActions.delete(id).statusCode(204);
  }

  @Test
  @DisplayName("restoring a deleted epic keeps it in its creation position")
  void restoreKeepsOrder() {
    String second = EpicApi.createId(initiativeId, "Second");
    EpicActions.delete(id).statusCode(204);
    EpicActions.restore(id).statusCode(200);

    EpicApi.list(initiativeId).body(NAME, contains(DESIGN, "Second"));
    EpicApi.get(second).statusCode(200);
  }

  @Test
  @DisplayName("unarchive of a deleted epic is 404")
  void unarchiveDeleted() {
    EpicActions.delete(id).statusCode(204);

    InitiativeAssertions.assertNotFound(EpicActions.unarchive(id));
  }
}
