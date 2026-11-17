package br.com.davisoares.bouleplan.integration;

import io.quarkus.narayana.jta.QuarkusTransaction;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.UUID;

/** Inserts introspection rows with native SQL, to test the constraints of the table. */
final class IntrospectionRows {

  static final LocalDate MONDAY = LocalDate.of(2026, 11, 16);

  private final EntityManager entityManager;
  private final UUID userId;

  IntrospectionRows(EntityManager entityManager, UUID userId) {
    this.entityManager = entityManager;
    this.userId = userId;
  }

  void insert(UUID user, LocalDate week, String answersJson) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into introspection (id, user_id, week_start, answers)"
                      + " values (?1, ?2, ?3, cast(?4 as jsonb))")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, user)
              .setParameter(3, week)
              .setParameter(4, answersJson)
              .executeUpdate();
        });
  }

  void insertWeek(LocalDate week) {
    insert(userId, week, "[]");
  }

  void insertAnswers(String answersJson) {
    insert(userId, MONDAY, answersJson);
  }

  void insertOf(UUID user) {
    insert(user, MONDAY, "[]");
  }

  void insertWithoutAnswers() {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into introspection (id, user_id, week_start) values (?1, ?2, ?3)")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, userId)
              .setParameter(3, MONDAY)
              .executeUpdate();
        });
  }

  String storedAnswers() {
    return (String)
        QuarkusTransaction.requiringNew()
            .call(() ->
                entityManager
                    .createNativeQuery("select cast(answers as text) from introspection")
                    .getSingleResult());
  }

  long count() {
    return ((Number)
            QuarkusTransaction.requiringNew()
                .call(() ->
                    entityManager
                        .createNativeQuery("select count(*) from introspection")
                        .getSingleResult()))
        .longValue();
  }
}
