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

/** Inserts calendar event rows with native SQL, to test the constraints of the table. */
final class CalendarEventRows {

  static final LocalDate DAY = LocalDate.of(2026, 11, 17);

  private final EntityManager entityManager;
  private final UUID userId;

  CalendarEventRows(EntityManager entityManager, UUID userId) {
    this.entityManager = entityManager;
    this.userId = userId;
  }

  void insert(UUID user, String title, String googleId, LocalTime start, LocalTime end) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into calendar_event"
                      + " (id, user_id, google_event_id, title, date, start_time, end_time)"
                      + " values (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, user)
              .setParameter(3, googleId)
              .setParameter(4, title)
              .setParameter(5, DAY)
              .setParameter(6, start)
              .setParameter(7, end)
              .executeUpdate();
        });
  }

  void insertTimes(LocalTime start, LocalTime end) {
    insert(userId, "Dentist", null, start, end);
  }

  void insertEnd(String endLiteral) {
    QuarkusTransaction.requiringNew()
        .run(() -> {
          entityManager
              .createNativeQuery(
                  "insert into calendar_event (id, user_id, title, date, start_time, end_time)"
                      + " values (?1, ?2, 'Late', ?3, time '23:00', cast(?4 as time))")
              .setParameter(1, UUID.randomUUID())
              .setParameter(2, userId)
              .setParameter(3, DAY)
              .setParameter(4, endLiteral)
              .executeUpdate();
        });
  }

  void insertTitled(String title) {
    insert(userId, title, null, LocalTime.of(9, 0), LocalTime.of(10, 0));
  }

  void insertGoogle(String googleId) {
    insert(userId, "Dentist", googleId, LocalTime.of(9, 0), LocalTime.of(10, 0));
  }

  void insertOf(UUID user) {
    insert(user, "Dentist", null, LocalTime.of(9, 0), LocalTime.of(10, 0));
  }

  void assertRejected(LocalTime start, LocalTime end) {
    assertThatThrownBy(() -> insertTimes(start, end))
        .as("%s - %s", start, end)
        .isInstanceOf(PersistenceException.class)
        .hasRootCauseInstanceOf(SQLException.class);
  }

  void assertAccepted(LocalTime start, LocalTime end) {
    assertThatCode(() -> insertTimes(start, end))
        .as("%s - %s", start, end)
        .doesNotThrowAnyException();
  }

  long count() {
    return ((Number)
            QuarkusTransaction.requiringNew()
                .call(() ->
                    entityManager
                        .createNativeQuery("select count(*) from calendar_event")
                        .getSingleResult()))
        .longValue();
  }
}
