package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TaskSchemaTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject EntityManager entityManager;

  private TaskRows rows;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    UUID initiativeId = createInitiative.create("Study").getId();
    rows =
        new TaskRows(
            entityManager, UUID.fromString(TestData.insertImplicitPhase(initiativeId.toString())));
  }

  @Test
  @DisplayName("a title is required, not blank and at most 300 characters")
  void title() {
    assertThatThrownBy(() -> rows.insertTitled(null)).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertTitled("")).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertTitled("   ")).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertTitled("a".repeat(301)))
        .isInstanceOf(PersistenceException.class);
    assertThatCode(() -> rows.insertTitled("a".repeat(300))).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("a task needs an existing phase")
  void phaseReference() {
    assertThatThrownBy(() -> rows.insertInPhase(UUID.randomUUID()))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertInPhase(null)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("the origin is native and the blocked flag cannot be null")
  void originAndBlocked() {
    rows.assertRejected("origin", "calendar");
    rows.assertRejected("origin", null);
    rows.assertRejected("is_blocked", null);
    rows.assertAccepted("origin", "native");
    rows.assertAccepted("is_blocked", true);
  }

  @Test
  @DisplayName("defaults: P2, to_do, native, not blocked, no dates")
  void defaults() {
    rows.assertAccepted(null, null);

    Object[] row =
        rows.onlyRow(
            "priority, status, origin, is_blocked, deadline, planned_week_start,"
                + " estimated_effort, description, archived_at, deleted_at, created_at,"
                + " updated_at");

    assertThat(row)
        .startsWith("P2", "to_do", "native", false)
        .containsSequence(null, null, null, null, null, null);
    assertThat(row[10]).isNotNull();
    assertThat(row[11]).isNotNull();
  }
}
