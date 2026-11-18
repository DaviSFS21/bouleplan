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
class EpicNotFoundResourceTest {

  @Inject EntityManager entityManager;

  private String initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = EpicApi.initiativeId("Study");
  }

  private static void assertEveryOperationNotFound(String epicId) {
    InitiativeAssertions.assertNotFound(EpicApi.get(epicId));
    InitiativeAssertions.assertNotFound(EpicApi.patch(epicId, EpicApi.NEW_NAME));
    InitiativeAssertions.assertNotFound(EpicActions.archive(epicId));
    InitiativeAssertions.assertNotFound(EpicActions.unarchive(epicId));
    InitiativeAssertions.assertNotFound(EpicActions.delete(epicId));
    InitiativeAssertions.assertNotFound(EpicActions.restore(epicId));
  }

  @Test
  @DisplayName("listing and creating on an unknown initiative are 404")
  void unknownInitiative() {
    String unknown = UUID.randomUUID().toString();

    InitiativeAssertions.assertNotFound(EpicApi.list(unknown));
    InitiativeAssertions.assertNotFound(EpicApi.post(unknown, EpicApi.NEW_NAME));
  }

  @Test
  @DisplayName("an unknown epic is 404 for every operation")
  void unknownEpic() {
    assertEveryOperationNotFound(UUID.randomUUID().toString());
  }

  @Test
  @DisplayName("an epic of another user is 404 for every operation")
  void foreignEpic() {
    assertEveryOperationNotFound(TestData.insertForeignEpic(entityManager));
  }

  @Test
  @DisplayName("an implicit epic is never listed and cannot be touched over REST")
  void implicitEpicIsHidden() {
    String implicit = TestData.insertImplicitEpic(initiativeId);
    EpicApi.create(initiativeId, "Design");

    EpicApi.list(initiativeId).body(EpicApi.NAME, Matchers.contains("Design"));
    assertEveryOperationNotFound(implicit);
  }
}
