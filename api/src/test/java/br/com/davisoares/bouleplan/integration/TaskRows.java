package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import jakarta.persistence.Query;
import java.sql.SQLException;
import java.util.UUID;

/** Inserts task rows with native SQL, to test the constraints of the table. */
final class TaskRows {

  static final String EFFORT = "estimated_effort";
  static final String PRIORITY = "priority";
  static final String STATUS = "status";
  static final String PLANNED_WEEK = "planned_week_start";

  private final EntityManager entityManager;
  private final UUID phaseId;

  TaskRows(EntityManager entityManager, UUID phaseId) {
    this.entityManager = entityManager;
    this.phaseId = phaseId;
  }

  /** Inserts a task with a valid title and, if given, one more column. */
  void insert(String column, Object value) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          String extraColumn = column == null ? "" : ", " + column;
          String extraValue = column == null ? "" : ", ?3";
          Query query =
              entityManager
                  .createNativeQuery(
                      "insert into task (id, phase_id, title"
                          + extraColumn
                          + ") values (?1, ?2, 'Write'"
                          + extraValue
                          + ")")
                  .setParameter(1, UUID.randomUUID())
                  .setParameter(2, phaseId);
          if (column != null) {
            query.setParameter(3, value);
          }
          query.executeUpdate();
        });
  }

  /** Inserts a task with this title. */
  void insertTitled(String title) {
    insertRaw(phaseId, title);
  }

  /** Inserts a task of this phase, which may not exist. */
  void insertInPhase(UUID phase) {
    insertRaw(phase, "x");
  }

  private void insertRaw(UUID phase, String title) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into task (id, phase_id, title) values (?1, ?2, ?3)")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, phase)
              .setParameter(3, title)
              .executeUpdate();
        });
  }

  void assertRejected(String column, Object value) {
    assertThatThrownBy(() -> insert(column, value))
        .as("%s = %s", column, value)
        .isInstanceOf(PersistenceException.class)
        .hasRootCauseInstanceOf(SQLException.class);
  }

  void assertAccepted(String column, Object value) {
    assertThatCode(() -> insert(column, value))
        .as("%s = %s", column, value)
        .doesNotThrowAnyException();
  }

  /** The only row of the table, read column by column in the given order. */
  Object[] onlyRow(String columns) {
    assertThat(columns).isNotBlank();
    return (Object[])
        QuarkusTransaction.requiringNew()
            .call(() ->
                entityManager
                    .createNativeQuery("select " + columns + " from task")
                    .getSingleResult());
  }
}
