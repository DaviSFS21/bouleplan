package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PhaseSchemaTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject EntityManager entityManager;

  private UUID initiativeId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    initiativeId = createInitiative.create("Study").getId();
  }

  private void insert(String name, boolean implicit) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into phase (id, initiative_id, name, is_implicit)"
                      + " values (?1, ?2, ?3, ?4)")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, initiativeId)
              .setParameter(3, name)
              .setParameter(4, implicit)
              .executeUpdate();
        });
  }

  @Test
  @DisplayName("a named phase needs a non-blank name")
  void namedPhaseNeedsName() {
    assertThatThrownBy(() -> insert(null, false)).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> insert("  ", false)).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> insert("", false)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("an implicit phase must not have a name")
  void implicitPhaseHasNoName() {
    assertThatThrownBy(() -> insert("Named", true)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("valid named and implicit rows are accepted, and only one implicit per initiative")
  void validRows() {
    assertThatCode(() -> insert("Design", false)).doesNotThrowAnyException();
    assertThatCode(() -> insert(null, true)).doesNotThrowAnyException();

    assertThatThrownBy(() -> insert(null, true)).isInstanceOf(PersistenceException.class);
  }
}
