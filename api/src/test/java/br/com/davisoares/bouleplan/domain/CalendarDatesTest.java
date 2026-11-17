package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CalendarDatesTest {

  @Test
  @DisplayName("only Mondays are Mondays")
  void isMonday() {
    assertThat(CalendarDates.isMonday(LocalDate.of(2026, 11, 16))).isTrue();
    assertThat(CalendarDates.isMonday(LocalDate.of(2026, 11, 17))).isFalse();
    assertThat(CalendarDates.isMonday(LocalDate.of(2026, 11, 22))).isFalse();
  }
}
