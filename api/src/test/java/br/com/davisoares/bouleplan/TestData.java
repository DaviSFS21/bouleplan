package br.com.davisoares.bouleplan;

import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Phase;
import br.com.davisoares.bouleplan.domain.Task;
import io.quarkus.hibernate.orm.panache.Panache;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/** Database cleanup shared by tests that commit data (HTTP calls run in their own transaction). */
public final class TestData {

  private TestData() {}

  /** Deletes every blocker, task, phase and then initiative, in a committed transaction. */
  public static void deleteAllInitiatives() {
    // A method reference would call the unenhanced Panache static and fail at runtime.
    QuarkusTransaction.requiringNew()
        .run(() -> {
          Panache.getEntityManager().createNativeQuery("delete from task_blocker").executeUpdate();
          Task.deleteAll();
          Phase.deleteAll();
          Initiative.deleteAll();
        });
  }

  /** Inserts an archived, deleted initiative of another user and returns its id. */
  public static String insertForeignInitiative(EntityManager entityManager) {
    UUID otherUser = UUID.randomUUID();
    UUID foreignId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into app_user (id, name) values (?1, 'Other')")
              .setParameter(1, otherUser)
              .executeUpdate();
          entityManager
              .createNativeQuery(
                  "insert into initiative (id, user_id, name, color, archived_at, deleted_at)"
                      + " values (?1, ?2, 'Theirs', 'azul', now(), now())")
              .setParameter(1, foreignId)
              .setParameter(2, otherUser)
              .executeUpdate();
        });
    return foreignId.toString();
  }

  /** Stamps {@code deleted_at} straight in the database, bypassing the use cases. */
  public static void markDeleted(EntityManager entityManager, String id) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("update initiative set deleted_at = now() where id = ?1")
              .setParameter(1, UUID.fromString(id))
              .executeUpdate();
        });
  }

  /** Persists the implicit phase of an initiative and returns its id. */
  public static String insertImplicitPhase(String initiativeId) {
    return QuarkusTransaction.requiringNew()
        .call(() -> {
          Phase phase = Phase.createImplicit(UUID.fromString(initiativeId));
          phase.persist();
          return phase.getId().toString();
        });
  }

  /**
   * Inserts an active initiative with an active phase, both of another user; returns the phase id.
   */
  public static String insertForeignPhase(EntityManager entityManager) {
    UUID otherUser = UUID.randomUUID();
    UUID initiativeId = UUID.randomUUID();
    UUID phaseId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into app_user (id, name) values (?1, 'Other')")
              .setParameter(1, otherUser)
              .executeUpdate();
          entityManager
              .createNativeQuery(
                  "insert into initiative (id, user_id, name, color)"
                      + " values (?1, ?2, 'Theirs', 'azul')")
              .setParameter(1, initiativeId)
              .setParameter(2, otherUser)
              .executeUpdate();
          entityManager
              .createNativeQuery(
                  "insert into phase (id, initiative_id, name) values (?1, ?2, 'Theirs')")
              .setParameter(1, phaseId)
              .setParameter(2, initiativeId)
              .executeUpdate();
        });
    return phaseId.toString();
  }

  /** Clears {@code archived_at} of an initiative straight in the database. */
  public static void unarchiveInitiative(EntityManager entityManager, UUID id) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("update initiative set archived_at = null where id = ?1")
              .setParameter(1, id)
              .executeUpdate();
        });
  }

  /** Counts the implicit phases of an initiative. */
  public static long countImplicitPhases(EntityManager entityManager, String initiativeId) {
    return QuarkusTransaction.requiringNew()
        .call(() ->
            (Long)
                entityManager
                    .createQuery(
                        "select count(p) from Phase p"
                            + " where p.initiativeId = ?1 and p.implicit = true")
                    .setParameter(1, UUID.fromString(initiativeId))
                    .getSingleResult());
  }

  /** Inserts an active initiative, phase and task, all of another user; returns the task id. */
  public static String insertForeignTask(EntityManager entityManager) {
    String phaseId = insertForeignPhase(entityManager);
    UUID taskId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into task (id, phase_id, title) values (?1, ?2, 'Theirs')")
              .setParameter(1, taskId)
              .setParameter(2, UUID.fromString(phaseId))
              .executeUpdate();
        });
    return taskId.toString();
  }

  /** Stamps {@code deleted_at} of a phase straight in the database. */
  public static void markPhaseDeleted(EntityManager entityManager, String id) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("update phase set deleted_at = now() where id = ?1")
              .setParameter(1, UUID.fromString(id))
              .executeUpdate();
        });
  }
}
