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
class InitiativeArchiveResourceTest {

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
  @DisplayName("archive returns the initiative, hides it from the list and frees its color")
  void archiveHidesAndFreesColor() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));

    InitiativeActions.archive(id).statusCode(200).body(NAME, Matchers.equalTo(FIRST));

    InitiativeAssertions.assertListed();
    InitiativeApi.get(id).statusCode(404);
    InitiativeApi.post("{\"name\": \"Second\"}")
        .statusCode(201)
        .body(COLOR, Matchers.equalTo(YELLOW));
  }

  @Test
  @DisplayName("archiving an archived initiative is 404 because it is no longer active")
  void archiveTwice() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));
    InitiativeActions.archive(id).statusCode(200);

    InitiativeAssertions.assertNotFound(InitiativeActions.archive(id));
  }

  @Test
  @DisplayName("unarchive brings the initiative back with its color")
  void unarchiveKeepsColor() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));
    InitiativeActions.archive(id).statusCode(200);
    InitiativeApi.create("Second");

    InitiativeActions.unarchive(id).statusCode(200).body(COLOR, Matchers.equalTo(YELLOW));

    InitiativeAssertions.assertListed(FIRST, "Second");
    InitiativeApi.list().body(COLOR, Matchers.contains(YELLOW, YELLOW));
  }

  @Test
  @DisplayName("unarchive of an active initiative is a 200 no-op")
  void unarchiveActive() {
    String id = InitiativeApi.idOf(InitiativeApi.create(FIRST));

    InitiativeActions.unarchive(id).statusCode(200).body(NAME, Matchers.equalTo(FIRST));
    InitiativeActions.unarchive(id).statusCode(200);
    InitiativeAssertions.assertListed(FIRST);
  }

  @Test
  @DisplayName("unarchive of a deleted, unknown or foreign initiative is 404")
  void unarchiveNotFound() {
    String deleted = InitiativeApi.idOf(InitiativeApi.create("Gone"));
    InitiativeActions.delete(deleted).statusCode(204);

    InitiativeAssertions.assertNotFound(InitiativeActions.unarchive(deleted));
    InitiativeAssertions.assertNotFound(InitiativeActions.unarchive(UUID.randomUUID().toString()));
    InitiativeAssertions.assertNotFound(
        InitiativeActions.unarchive(TestData.insertForeignInitiative(entityManager)));
  }
}
