package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeDeadlineTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final Initiative initiative = Initiative.create(USER_ID, "Study", InitiativeColor.BLUE);

  private static void assertCode(Runnable action, String code) {
    assertThatThrownBy(action::run)
        .isInstanceOf(InvalidInitiativeException.class)
        .extracting(e -> ((InvalidInitiativeException) e).code())
        .isEqualTo(code);
  }

  @Test
  @DisplayName("scheduleDeadline sets and clears the deadline")
  void deadline() {
    initiative.scheduleDeadline(LocalDate.of(2027, 1, 31));
    assertThat(initiative.getOverallDeadline()).isEqualTo(LocalDate.of(2027, 1, 31));

    initiative.scheduleDeadline(null);
    assertThat(initiative.getOverallDeadline()).isNull();
  }

  @Test
  @DisplayName("scheduleDeadline accepts years 1 to 9999 and rejects others")
  void deadlineYearRange() {
    initiative.scheduleDeadline(LocalDate.of(1, 1, 1));
    initiative.scheduleDeadline(LocalDate.of(9999, 12, 31));

    assertCode(
        () -> initiative.scheduleDeadline(LocalDate.of(10_000, 1, 1)),
        "initiative.deadline.invalid");
    assertCode(
        () -> initiative.scheduleDeadline(LocalDate.of(0, 12, 31)), "initiative.deadline.invalid");
    assertCode(
        () -> initiative.scheduleDeadline(LocalDate.of(999_999_999, 1, 1)),
        "initiative.deadline.invalid");
    assertThat(initiative.getOverallDeadline()).isEqualTo(LocalDate.of(9999, 12, 31));
  }
}
