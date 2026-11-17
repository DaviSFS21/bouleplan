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
class InitiativeDeleteResourceTest {

  private static final String NAME = "name";
  private static final String COLOR = "color";
  private static final String FIRST = "First";
  private static final String YELLOW = "amarelo";

  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("delete returns 204 and hides the initiative; restore brings it back")
  void deleteAndRestore() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));

    InitiativeActions.delete(id).statusCode(204).body(Matchers.emptyString());

    InitiativeAssertions.assertListed();
    InitiativeApi.get(id).statusCode(404);

    InitiativeActions.restore(id)
        .statusCode(200)
        .body(NAME, Matchers.equalTo(FIRST))
        .body(COLOR, Matchers.equalTo(YELLOW));
    InitiativeAssertions.assertListed(FIRST);
  }

  @Test
  @DisplayName("delete of an archived, deleted, unknown or foreign initiative is 404")
  void deleteNotFound() {
    String archived = InitiativeApi.idOf(InitiativeApi.create("Archived"));
    InitiativeActions.archive(archived).statusCode(200);
    String deleted = InitiativeApi.idOf(InitiativeApi.create("Deleted"));
    InitiativeActions.delete(deleted).statusCode(204);

    InitiativeAssertions.assertNotFound(InitiativeActions.delete(archived));
    InitiativeAssertions.assertNotFound(InitiativeActions.delete(deleted));
    InitiativeAssertions.assertNotFound(InitiativeActions.delete(UUID.randomUUID().toString()));
    InitiativeAssertions.assertNotFound(
        InitiativeActions.delete(TestData.insertForeignInitiative(entityManager)));
  }

  @Test
  @DisplayName("restore of an initiative that is not deleted is a 200 no-op")
  void restoreNotDeleted() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));

    InitiativeActions.restore(id).statusCode(200).body(NAME, Matchers.equalTo(FIRST));
    InitiativeActions.restore(id).statusCode(200);
    InitiativeAssertions.assertListed(FIRST);
  }

  @Test
  @DisplayName("restore keeps the color even if it now repeats")
  void restoreKeepsRepeatedColor() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));
    InitiativeActions.delete(id).statusCode(204);
    InitiativeApi.create("Second");

    InitiativeActions.restore(id).statusCode(200).body(COLOR, Matchers.equalTo(YELLOW));
    InitiativeApi.list().body(COLOR, Matchers.contains(YELLOW, YELLOW));
  }

  @Test
  @DisplayName("restoring a deleted archived initiative leaves it archived")
  void restoreArchived() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));
    InitiativeActions.archive(id).statusCode(200);
    InitiativeActions.delete(id).statusCode(404);
    TestData.markDeleted(entityManager, id);

    InitiativeActions.restore(id).statusCode(200);

    InitiativeAssertions.assertListed();
    InitiativeActions.unarchive(id).statusCode(200);
    InitiativeAssertions.assertListed(FIRST);
  }

  @Test
  @DisplayName("restore of an unknown or foreign initiative is 404")
  void restoreNotFound() {
    InitiativeAssertions.assertNotFound(InitiativeActions.restore(UUID.randomUUID().toString()));
    InitiativeAssertions.assertNotFound(
        InitiativeActions.restore(TestData.insertForeignInitiative(entityManager)));
  }
}
