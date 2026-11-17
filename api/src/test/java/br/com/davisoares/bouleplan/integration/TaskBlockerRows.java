package br.com.davisoares.bouleplan.integration;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/** Inserts tasks and blocker rows with native SQL, to test the constraints of the table. */
final class TaskBlockerRows {

  private final EntityManager entityManager;
  private final UUID phaseId;

  TaskBlockerRows(EntityManager entityManager, UUID phaseId) {
    this.entityManager = entityManager;
    this.phaseId = phaseId;
  }

  UUID insertTask() {
    UUID id = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into task (id, phase_id, title) values (?1, ?2, 'x')")
              .setParameter(1, id)
              .setParameter(2, phaseId)
              .executeUpdate();
        });
    return id;
  }

  void insertBlocker(UUID blockingId, UUID blockedId) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into task_blocker (blocking_task_id, blocked_task_id) values (?1, ?2)")
              .setParameter(1, blockingId)
              .setParameter(2, blockedId)
              .executeUpdate();
        });
  }

  void deleteTask(UUID id) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("delete from task where id = ?1")
              .setParameter(1, id)
              .executeUpdate();
        });
  }

  Object[] onlyRow() {
    return (Object[])
        QuarkusTransaction.requiringNew()
            .call(() ->
                entityManager
                    .createNativeQuery(
                        "select blocking_task_id, blocked_task_id, created_at from task_blocker")
                    .getSingleResult());
  }

  long count() {
    return ((Number)
            QuarkusTransaction.requiringNew()
                .call(() ->
                    entityManager
                        .createNativeQuery("select count(*) from task_blocker")
                        .getSingleResult()))
        .longValue();
  }
}
