package br.com.davisoares.bouleplan;

import br.com.davisoares.bouleplan.domain.Epic;
import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Task;
import io.quarkus.hibernate.orm.panache.Panache;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/** Database cleanup shared by tests that commit data (HTTP calls run in their own transaction). */
@SuppressWarnings("PMD.TooManyMethods") // one cleanup or insert helper per table
public final class TestData {

  private TestData() {}

  /**
   * Deletes every item, event, blocker, task, epic and then initiative, in a committed transaction.
   */
  public static void deleteAllInitiatives() {
    // A method reference would call the unenhanced Panache static and fail at runtime.
    QuarkusTransaction.requiringNew()
        .run(() -> {
          Panache.getEntityManager()
              .createNativeQuery("delete from scheduled_item")
              .executeUpdate();
          Panache.getEntityManager()
              .createNativeQuery("delete from calendar_event")
              .executeUpdate();
          Panache.getEntityManager().createNativeQuery("delete from introspection").executeUpdate();
          Panache.getEntityManager().createNativeQuery("delete from task_blocker").executeUpdate();
          Task.deleteAll();
          Epic.deleteAll();
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

  /** Persists the implicit epic of an initiative and returns its id. */
  public static String insertImplicitEpic(String initiativeId) {
    return QuarkusTransaction.requiringNew()
        .call(() -> {
          Epic epic = Epic.createImplicit(UUID.fromString(initiativeId));
          epic.persist();
          return epic.getId().toString();
        });
  }

  /**
   * Inserts an active initiative with an active epic, both of another user; returns the epic id.
   */
  public static String insertForeignEpic(EntityManager entityManager) {
    UUID otherUser = UUID.randomUUID();
    UUID initiativeId = UUID.randomUUID();
    UUID epicId = UUID.randomUUID();
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
                  "insert into epic (id, initiative_id, name) values (?1, ?2, 'Theirs')")
              .setParameter(1, epicId)
              .setParameter(2, initiativeId)
              .executeUpdate();
        });
    return epicId.toString();
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

  /** Counts the implicit epics of an initiative. */
  public static long countImplicitEpics(EntityManager entityManager, String initiativeId) {
    return QuarkusTransaction.requiringNew()
        .call(() ->
            (Long)
                entityManager
                    .createQuery(
                        "select count(p) from Epic p"
                            + " where p.initiativeId = ?1 and p.implicit = true")
                    .setParameter(1, UUID.fromString(initiativeId))
                    .getSingleResult());
  }

  /** Inserts an active initiative, epic and task, all of another user; returns the task id. */
  public static String insertForeignTask(EntityManager entityManager) {
    String epicId = insertForeignEpic(entityManager);
    UUID taskId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into task (id, epic_id, title) values (?1, ?2, 'Theirs')")
              .setParameter(1, taskId)
              .setParameter(2, UUID.fromString(epicId))
              .executeUpdate();
        });
    return taskId.toString();
  }

  /** Stamps {@code deleted_at} of an epic straight in the database. */
  public static void markEpicDeleted(EntityManager entityManager, String id) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("update epic set deleted_at = now() where id = ?1")
              .setParameter(1, UUID.fromString(id))
              .executeUpdate();
        });
  }

  /** Inserts an event of another user and returns its id. */
  public static String insertForeignEvent(EntityManager entityManager) {
    UUID otherUser = UUID.randomUUID();
    UUID eventId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery("insert into app_user (id, name) values (?1, 'Other')")
              .setParameter(1, otherUser)
              .executeUpdate();
          entityManager
              .createNativeQuery(
                  "insert into calendar_event (id, user_id, title, date, start_time, end_time)"
                      + " values (?1, ?2, 'Theirs', date '2026-11-17', time '09:00', time '10:00')")
              .setParameter(1, eventId)
              .setParameter(2, otherUser)
              .executeUpdate();
        });
    return eventId.toString();
  }

  /** Inserts a day-list entry and a block for a task of another user; returns the block id. */
  public static String insertForeignItem(EntityManager entityManager, String taskId) {
    UUID blockId = UUID.randomUUID();
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into scheduled_item (id, task_id, date, sort_order)"
                      + " values (?1, ?2, date '2026-11-17', 0)")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, UUID.fromString(taskId))
              .executeUpdate();
          entityManager
              .createNativeQuery(
                  "insert into scheduled_item (id, task_id, date, start_time, end_time)"
                      + " values (?1, ?2, date '2026-11-17', time '09:00', time '10:00')")
              .setParameter(1, blockId)
              .setParameter(2, UUID.fromString(taskId))
              .executeUpdate();
        });
    return blockId.toString();
  }
}
