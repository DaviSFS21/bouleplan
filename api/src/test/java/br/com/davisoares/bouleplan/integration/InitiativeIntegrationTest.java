package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListInitiativesUseCase;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.InitiativeColor;
import br.com.davisoares.bouleplan.domain.InitiativeOrigin;
import io.quarkus.test.TestTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestTransaction
class InitiativeIntegrationTest {

  private static final String FIRST = "First";

  private static final String LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject ListInitiativesUseCase listInitiatives;
  @Inject GetInitiativeUseCase getInitiative;
  @Inject EntityManager entityManager;

  @BeforeEach
  void cleanDatabase() {
    TestData.deleteAllInitiatives();
  }

  @Test
  @DisplayName("creating persists the initiative with the suggested color")
  void createPersistsWithSuggestedColor() {
    Initiative created = createInitiative.create("  Study plan ");
    entityManager.flush();
    entityManager.clear();

    Initiative found = entityManager.find(Initiative.class, created.getId());

    assertThat(found.getName()).isEqualTo("Study plan");
    assertThat(found.getColor()).isEqualTo(InitiativeColor.YELLOW);
    assertThat(found.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(found.getUserId()).isEqualTo(UUID.fromString(LOCAL_USER_ID));
    assertThat(found.getCreatedAt()).isNotNull();
    assertThat(found.getUpdatedAt()).isNotNull();
  }

  @Test
  @DisplayName("the second initiative gets lime")
  void secondGetsLime() {
    createInitiative.create(FIRST);

    assertThat(createInitiative.create("Second").getColor()).isEqualTo(InitiativeColor.LIME);
  }

  @Test
  @DisplayName("listing returns only active initiatives, in creation order")
  void listsActiveInCreationOrder() {
    final UUID firstId = createInitiative.create(FIRST).getId();
    createInitiative.create("Archived").archive();
    final UUID thirdId = createInitiative.create("Third").getId();
    entityManager.flush();
    entityManager.clear();

    assertThat(listInitiatives.listActive())
        .extracting(Initiative::getId)
        .containsExactly(firstId, thirdId);
  }

  @Test
  @DisplayName("an archived initiative frees its color")
  void archivedFreesColor() {
    createInitiative.create(FIRST).archive();
    entityManager.flush();
    entityManager.clear();

    assertThat(createInitiative.create("Second").getColor()).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("the database rejects a blank name inserted with native SQL")
  void databaseRejectsBlankName() {
    Query insert =
        entityManager
            .createNativeQuery(
                "insert into initiative (id, user_id, name, color) values (?1, ?2, '   ', 'azul')")
            .setParameter(1, UUID.randomUUID())
            .setParameter(2, UUID.fromString(LOCAL_USER_ID));

    assertThatThrownBy(insert::executeUpdate).hasMessageContaining("initiative_name_not_blank");
  }

  @Test
  @DisplayName("a soft-deleted initiative is not listed and frees its color")
  void deletedIsHiddenAndFreesColor() {
    final UUID firstId = createInitiative.create(FIRST).getId();
    entityManager.flush();
    entityManager
        .createNativeQuery("update initiative set deleted_at = now() where id = ?1")
        .setParameter(1, firstId)
        .executeUpdate();
    entityManager.clear();

    assertThat(listInitiatives.listActive()).isEmpty();
    assertThat(createInitiative.create("Second").getColor()).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("find returns an active initiative of the user and hides deleted or foreign ones")
  void findScopedToActiveOwn() {
    final UUID id = createInitiative.create(FIRST).getId();
    entityManager.flush();
    entityManager.clear();

    assertThat(getInitiative.find(id)).isPresent();

    entityManager
        .createNativeQuery("update initiative set deleted_at = now() where id = ?1")
        .setParameter(1, id)
        .executeUpdate();
    entityManager.clear();
    assertThat(getInitiative.find(id)).isEmpty();
  }

  @Test
  @DisplayName("an initiative of another user is not found")
  void foreignInitiativeNotFound() {
    UUID otherUser = UUID.randomUUID();
    UUID foreignId = UUID.randomUUID();
    entityManager
        .createNativeQuery("insert into app_user (id, name) values (?1, 'Other')")
        .setParameter(1, otherUser)
        .executeUpdate();
    entityManager
        .createNativeQuery(
            "insert into initiative (id, user_id, name, color) values (?1, ?2, 'Theirs', 'azul')")
        .setParameter(1, foreignId)
        .setParameter(2, otherUser)
        .executeUpdate();
    entityManager.clear();

    assertThat(getInitiative.find(foreignId)).isEmpty();
  }
}
