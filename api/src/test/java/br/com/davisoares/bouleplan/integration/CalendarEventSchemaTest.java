package br.com.davisoares.bouleplan.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.davisoares.bouleplan.TestData;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
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
class CalendarEventSchemaTest {

  @Inject CurrentUser currentUser;
  @Inject EntityManager entityManager;

  private CalendarEventRows rows;

  @BeforeEach
  void prepare() {
    TestData.deleteAllInitiatives();
    rows = new CalendarEventRows(entityManager, currentUser.id());
  }

  @Test
  @DisplayName("a title is required, not blank and at most 300 characters")
  void title() {
    assertThatThrownBy(() -> rows.insertTitled(null)).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertTitled("")).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertTitled("   ")).isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertTitled("a".repeat(301)))
        .isInstanceOf(PersistenceException.class);
    assertThatCode(() -> rows.insertTitled("a".repeat(300))).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("an event needs an existing user")
  void userReference() {
    assertThatThrownBy(() -> rows.insertOf(UUID.randomUUID()))
        .isInstanceOf(PersistenceException.class);
    assertThatThrownBy(() -> rows.insertOf(null)).isInstanceOf(PersistenceException.class);
  }

  @Test
  @DisplayName("the start must be before the end")
  void timeOrder() {
    rows.assertRejected(LocalTime.of(10, 0), LocalTime.of(10, 0));
    rows.assertRejected(LocalTime.of(11, 0), LocalTime.of(10, 0));
    rows.assertAccepted(LocalTime.of(10, 0), LocalTime.of(10, 15));
  }

  @Test
  @DisplayName("both times are on a quarter hour with no seconds")
  void quarterHours() {
    rows.assertRejected(LocalTime.of(9, 10), LocalTime.of(10, 0));
    rows.assertRejected(LocalTime.of(9, 0), LocalTime.of(10, 5));
    rows.assertRejected(LocalTime.of(9, 0, 30), LocalTime.of(10, 0));
    rows.assertRejected(LocalTime.of(9, 0), LocalTime.of(10, 0, 1));
    rows.assertAccepted(LocalTime.of(0, 0), LocalTime.of(0, 15));
    rows.assertAccepted(LocalTime.of(9, 30), LocalTime.of(9, 45));
    rows.assertAccepted(LocalTime.of(23, 30), LocalTime.of(23, 45));
  }

  @Test
  @DisplayName("an event cannot end at 24:00")
  void endsWithinTheDay() {
    assertThatThrownBy(() -> rows.insertEnd("24:00"))
        .isInstanceOf(PersistenceException.class)
        .hasMessageContaining("calendar_event_quarter_hours");
    assertThatCode(() -> rows.insertEnd("23:45")).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("a Google event id is unique when present and may be absent many times")
  void googleEventId() {
    rows.insertGoogle(null);
    rows.insertGoogle(null);
    rows.insertGoogle("abc");

    assertThatThrownBy(() -> rows.insertGoogle("abc")).isInstanceOf(PersistenceException.class);
    assertThatCode(() -> rows.insertGoogle("abd")).doesNotThrowAnyException();
    assertThat(rows.count()).isEqualTo(4);
  }
}
