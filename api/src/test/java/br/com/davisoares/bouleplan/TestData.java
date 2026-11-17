package br.com.davisoares.bouleplan;

import br.com.davisoares.bouleplan.domain.Initiative;
import br.com.davisoares.bouleplan.domain.Phase;
import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import java.util.UUID;

/** Database cleanup shared by tests that commit data (HTTP calls run in their own transaction). */
public final class TestData {

  private TestData() {}

  /** Deletes every phase, then every initiative, in a committed transaction. */
  public static void deleteAllInitiatives() {
    // A method reference would call the unenhanced Panache static and fail at runtime.
    QuarkusTransaction.requiringNew()
        .run(() -> {
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
}
