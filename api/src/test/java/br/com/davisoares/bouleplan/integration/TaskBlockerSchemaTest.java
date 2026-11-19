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
class TaskBlockerSchemaTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject EntityManager entityManager;

  private TaskBlockerRows rows;
  private UUID first;
  private UUID second;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    UUID initiativeId = createInitiative.create("Study").getId();
    rows =
        new TaskBlockerRows(
            entityManager, UUID.fromString(TestData.insertImplicitEpic(initiativeId.toString())));
    first = rows.insertTask();
    second = rows.insertTask();
  }

  @Test
  @DisplayName("a blocker links two existing tasks and stamps its creation")
  void link() {
    rows.insertBlocker(first, second);

    Object[] row = rows.onlyRow();

    assertThat(row[0]).isEqualTo(first);
    assertThat(row[1]).isEqualTo(second);
    assertThat(row[2]).isNotNull();
  }

  @Test
  @DisplayName("a task cannot block itself")
  void notSelf() {
    assertThatThrownBy(() -> rows.insertBlocker(first, first))
        .isInstanceOf(PersistenceException.class)
        .hasMessageContaining("task_blocker_not_self");
  }

  @Test
  @DisplayName("the same pair is stored once, but each direction is its own row")
  void primaryKey() {
    rows.insertBlocker(first, second);

    assertThatThrownBy(() -> rows.insertBlocker(first, second))
        .isInstanceOf(PersistenceException.class);
    assertThatCode(() -> rows.insertBlocker(second, first)).doesNotThrowAnyException();
    assertThat(rows.count()).isEqualTo(2);
  }

  @Test
  @DisplayName("both ends must be existing tasks")
  void references() {
    assertThatThrownBy(() -> rows.insertBlocker(first, UUID.randomUUID()))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertBlocker(UUID.randomUUID(), second))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertBlocker(null, second))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertBlocker(first, null))
        .isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("a task with blockers cannot be hard-deleted")
  void restrictsDelete() {
    rows.insertBlocker(first, second);

    assertThatThrownBy(() -> rows.deleteTask(second)).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.deleteTask(first)).isInstanceOf(PersistenceException.class);
  }
}
