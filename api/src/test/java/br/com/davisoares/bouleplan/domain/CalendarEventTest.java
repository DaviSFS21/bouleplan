package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CalendarEventTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final LocalDate DAY = LocalDate.of(2026, 11, 17);
  private static final LocalTime NINE = LocalTime.of(9, 0);
  private static final LocalTime TEN = LocalTime.of(10, 0);
  private static final String TIME_INVALID = "calendar-event.time.invalid";

  private static String codeOfTitle(String title) {
    return ((DomainRuleViolation)
            catchThrowable(() -> CalendarEvent.create(USER_ID, title, DAY, NINE, TEN)))
        .code();
  }

  private static String codeOfTimes(LocalDate date, LocalTime start, LocalTime end) {
    return ((DomainRuleViolation)
            catchThrowable(() -> CalendarEvent.create(USER_ID, "Dentist", date, start, end)))
        .code();
  }

  @Test
  @DisplayName("create trims the title and keeps the day and times")
  void create() {
    CalendarEvent event = CalendarEvent.create(USER_ID, "  Dentist ", DAY, NINE, TEN);

    assertThat(event.getTitle()).isEqualTo("Dentist");
    assertThat(event.getUserId()).isEqualTo(USER_ID);
    assertThat(event.getDate()).isEqualTo(DAY);
    assertThat(event.getStartTime()).isEqualTo(NINE);
    assertThat(event.getEndTime()).isEqualTo(TEN);
    assertThat(event.getGoogleEventId()).isNull();
  }

  @Test
  @DisplayName("the title is required, at most 300 characters and free of control characters")
  void title() {
    assertThat(codeOfTitle(" ")).isEqualTo("calendar-event.title.blank");
    assertThat(codeOfTitle(null)).isEqualTo("calendar-event.title.blank");
    assertThat(codeOfTitle("a".repeat(301))).isEqualTo("calendar-event.title.too-long");
    assertThat(codeOfTitle("a\u0000b")).isEqualTo("calendar-event.title.invalid-characters");
    assertThat(CalendarEvent.create(USER_ID, "a".repeat(300), DAY, NINE, TEN).getTitle())
        .hasSize(300);
  }

  @Test
  @DisplayName("times are quarter hours with the start before the end")
  void times() {
    assertThat(codeOfTimes(DAY, NINE, NINE)).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(DAY, TEN, NINE)).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(DAY, LocalTime.of(9, 10), TEN)).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(DAY, NINE, LocalTime.of(10, 0, 1))).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(DAY, null, TEN)).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(DAY, NINE, null)).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(null, NINE, TEN)).isEqualTo(TIME_INVALID);
    assertThat(codeOfTimes(LocalDate.of(10_000, 1, 1), NINE, TEN)).isEqualTo(TIME_INVALID);
    assertThat(CalendarEvent.create(USER_ID, "x", DAY, LocalTime.MIN, LocalTime.of(23, 45)))
        .isNotNull();
  }

  @Test
  @DisplayName("rename and reschedule apply the creation rules")
  void edit() {
    CalendarEvent event = CalendarEvent.create(USER_ID, "Dentist", DAY, NINE, TEN);

    event.rename(" Doctor ");
    event.reschedule(DAY.plusDays(1), TEN, LocalTime.of(11, 30));

    assertThat(event.getTitle()).isEqualTo("Doctor");
    assertThat(event.getDate()).isEqualTo(DAY.plusDays(1));
    assertThat(event.getStartTime()).isEqualTo(TEN);
    assertThat(event.getEndTime()).isEqualTo(LocalTime.of(11, 30));
    assertThat(((DomainRuleViolation) catchThrowable(() -> event.rename(""))).code())
        .isEqualTo("calendar-event.title.blank");
    assertThat(
            ((DomainRuleViolation) catchThrowable(() -> event.reschedule(DAY, TEN, NINE))).code())
        .isEqualTo(TIME_INVALID);
    assertThat(event.getStartTime()).isEqualTo(TEN);
  }
}
