package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestTransaction
class InitiativeIntegrationTest {

  private static final String LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001";

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject ListInitiativesUseCase listInitiatives;
  @Inject EntityManager entityManager;

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
    createInitiative.create("First");

    assertThat(createInitiative.create("Second").getColor()).isEqualTo(InitiativeColor.LIME);
  }

  @Test
  @DisplayName("listing returns only active initiatives, in creation order")
  void listsActiveInCreationOrder() {
    final UUID firstId = createInitiative.create("First").getId();
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
    createInitiative.create("First").archive();
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
}
