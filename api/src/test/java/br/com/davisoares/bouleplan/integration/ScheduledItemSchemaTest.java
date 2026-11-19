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
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ScheduledItemSchemaTest {

  @Inject CreateInitiativeUseCase createInitiative;
  @Inject EntityManager entityManager;

  private TaskBlockerRows tasks;
  private ScheduledItemRows rows;
  private UUID taskId;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    UUID initiativeId = createInitiative.create("Study").getId();
    tasks =
        new TaskBlockerRows(
            entityManager, UUID.fromString(TestData.insertImplicitEpic(initiativeId.toString())));
    taskId = tasks.insertTask();
    rows = new ScheduledItemRows(entityManager, taskId);
  }

  @Test
  @DisplayName("an item needs an existing task and a date")
  void references() {
    assertThatThrownBy(() -> rows.insertDayListOf(UUID.randomUUID()))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertDayListOf(null)).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertDayList(null, 0)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("an item is either a day-list entry with an order or a block with two times")
  void kind() {
    rows.assertRejected(() -> rows.insert(taskId, ScheduledItemRows.DAY, null, null, null), "none");
    rows.assertRejected(
        () ->
            rows.insert(taskId, ScheduledItemRows.DAY, LocalTime.of(9, 0), LocalTime.of(10, 0), 1),
        "block with order");
    rows.assertRejected(
        () -> rows.insert(taskId, ScheduledItemRows.DAY, LocalTime.of(9, 0), null, null),
        "start only");
    rows.assertRejected(
        () -> rows.insert(taskId, ScheduledItemRows.DAY, null, LocalTime.of(10, 0), null),
        "end only");
    rows.assertRejected(
        () -> rows.insert(taskId, ScheduledItemRows.DAY, null, LocalTime.of(10, 0), 1),
        "end and order");
    assertThatCode(() -> rows.insertDayList(ScheduledItemRows.DAY, 0)).doesNotThrowAnyException();
    rows.assertBlockAccepted(LocalTime.of(9, 0), LocalTime.of(10, 0));
    assertThat(rows.count()).isEqualTo(2);
  }

  @Test
  @DisplayName("a block starts before it ends")
  void timeOrder() {
    rows.assertBlockRejected(LocalTime.of(10, 0), LocalTime.of(10, 0));
    rows.assertBlockRejected(LocalTime.of(11, 0), LocalTime.of(10, 0));
    rows.assertBlockAccepted(LocalTime.of(10, 0), LocalTime.of(10, 15));
  }

  @Test
  @DisplayName("both times are on a quarter hour with no seconds")
  void quarterHours() {
    rows.assertBlockRejected(LocalTime.of(9, 10), LocalTime.of(10, 0));
    rows.assertBlockRejected(LocalTime.of(9, 0), LocalTime.of(10, 5));
    rows.assertBlockRejected(LocalTime.of(9, 0, 30), LocalTime.of(10, 0));
    rows.assertBlockRejected(LocalTime.of(9, 0), LocalTime.of(10, 0, 1));
    rows.assertBlockAccepted(LocalTime.of(0, 0), LocalTime.of(0, 15));
    rows.assertBlockAccepted(LocalTime.of(23, 30), LocalTime.of(23, 45));
  }

  @Test
  @DisplayName("a task enters a day list once, but may have blocks and other days")
  void dayListUniqueness() {
    rows.insertDayList(ScheduledItemRows.DAY, 0);

    assertThatThrownBy(() -> rows.insertDayList(ScheduledItemRows.DAY, 1))
        .isInstanceOf(PersistenceException.class)
        .hasMessageContaining("scheduled_item_day_list_idx");
    assertThatCode(() -> rows.insertDayList(ScheduledItemRows.DAY.plusDays(1), 0))
        .doesNotThrowAnyException();
    rows.assertBlockAccepted(LocalTime.of(9, 0), LocalTime.of(10, 0));
    rows.assertBlockAccepted(LocalTime.of(9, 0), LocalTime.of(10, 0));
    assertThatCode(() -> rows.insertDayListOf(tasks.insertTask())).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("a task with items cannot be hard-deleted")
  void restrictsDelete() {
    rows.insertDayList(ScheduledItemRows.DAY, 0);

    assertThatThrownBy(() -> tasks.deleteTask(taskId)).isInstanceOf(PersistenceException.class);
  }
}
