package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** Inserts scheduled item rows with native SQL, to test the constraints of the table. */
final class ScheduledItemRows {

  static final LocalDate DAY = LocalDate.of(2026, 11, 17);

  private final EntityManager entityManager;
  private final UUID taskId;

  ScheduledItemRows(EntityManager entityManager, UUID taskId) {
    this.entityManager = entityManager;
    this.taskId = taskId;
  }

  void insert(UUID task, LocalDate date, LocalTime start, LocalTime end, Integer sortOrder) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into scheduled_item (id, task_id, date, start_time, end_time, sort_order)"
                      + " values (?1, ?2, ?3, ?4, ?5, ?6)")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, task)
              .setParameter(3, date)
              .setParameter(4, start)
              .setParameter(5, end)
              .setParameter(6, sortOrder)
              .executeUpdate();
        });
  }

  void insertBlock(LocalTime start, LocalTime end) {
    insert(taskId, DAY, start, end, null);
  }

  void insertDayList(LocalDate date, Integer sortOrder) {
    insert(taskId, date, null, null, sortOrder);
  }

  void insertDayListOf(UUID task) {
    insert(task, DAY, null, null, 0);
  }

  void assertBlockRejected(LocalTime start, LocalTime end) {
    assertRejected(() -> insertBlock(start, end), start + " - " + end);
  }

  void assertBlockAccepted(LocalTime start, LocalTime end) {
    assertThatCode(() -> insertBlock(start, end))
        .as("%s - %s", start, end)
        .doesNotThrowAnyException();
  }

  void assertRejected(Runnable insert, String description) {
    assertThatThrownBy(insert::run)
        .as(description)
        .isInstanceOf(PersistenceException.class)
        .hasRootCauseInstanceOf(SQLException.class);
  }

  long count() {
    return ((Number)
            QuarkusTransaction.requiringNew()
                .call(() ->
                    entityManager
                        .createNativeQuery("select count(*) from scheduled_item")
                        .getSingleResult()))
        .longValue();
  }

  void deleteTask() {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("delete from scheduled_item where task_id = ?1")
              .setParameter(1, taskId)
              .executeUpdate();
          entityManager
              .createNativeQuery("delete from task where id = ?1")
              .setParameter(1, taskId)
              .executeUpdate();
        });
  }
}
