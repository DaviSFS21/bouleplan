package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TaskEditingTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

  private final Task task =
      Task.create(Phase.create(INITIATIVE_ID, "Design"), "Write", TaskStatus.TO_DO);

  private static void assertCode(Runnable action, String code) {
    assertThatThrownBy(action::run)
        .isInstanceOf(InvalidTaskException.class)
        .extracting(e -> ((InvalidTaskException) e).code())
        .isEqualTo(code);
  }

  private void assertEffortRejected(String value) {
    assertCode(() -> task.estimate(new BigDecimal(value)), "task.effort.invalid");
  }

  @Test
  @DisplayName("rename trims and applies the creation rules")
  void rename() {
    task.rename("  New title ");
    assertThat(task.getTitle()).isEqualTo("New title");

    assertCode(() -> task.rename(null), "task.title.blank");
    assertCode(() -> task.rename("a".repeat(301)), "task.title.too-long");
    assertCode(() -> task.rename("a\tb"), "task.title.invalid-characters");
    assertThat(task.getTitle()).isEqualTo("New title");
  }

  @Test
  @DisplayName("describe normalizes line breaks, trims, and turns blank into null")
  void describe() {
    task.describe("  one\r\ntwo\rthree\n\tfour \n");
    assertThat(task.getDescription()).isEqualTo("one\ntwo\nthree\n\tfour");

    task.describe(" \n ");
    assertThat(task.getDescription()).isNull();

    task.describe("text");
    task.describe(null);
    assertThat(task.getDescription()).isNull();
  }

  @Test
  @DisplayName("describe rejects control characters and more than 10000 characters")
  void describeRules() {
    assertCode(() -> task.describe("a".repeat(10_001)), "task.description.too-long");
    assertCode(() -> task.describe("a\u0000b"), "task.description.invalid-characters");
    task.describe("a".repeat(10_000));
    assertThat(task.getDescription()).hasSize(10_000);
  }

  @Test
  @DisplayName("scheduleDeadline accepts years 1 to 9999 and null clears")
  void deadline() {
    task.scheduleDeadline(LocalDate.of(2026, 11, 17));
    assertThat(task.getDeadline()).isEqualTo(LocalDate.of(2026, 11, 17));

    task.scheduleDeadline(null);
    assertThat(task.getDeadline()).isNull();

    assertCode(() -> task.scheduleDeadline(LocalDate.of(0, 12, 31)), "task.deadline.invalid");
    assertCode(() -> task.scheduleDeadline(LocalDate.of(10_000, 1, 1)), "task.deadline.invalid");
    task.scheduleDeadline(LocalDate.of(9999, 12, 31));
    assertThat(task.getDeadline()).isEqualTo(LocalDate.of(9999, 12, 31));
  }

  @Test
  @DisplayName("estimate accepts above 0 up to 999 with at most 2 decimals; null clears")
  void effort() {
    task.estimate(new BigDecimal("2.5"));
    assertThat(task.getEstimatedEffort()).isEqualByComparingTo("2.5");
    task.estimate(new BigDecimal("0.01"));
    task.estimate(new BigDecimal("999"));
    task.estimate(new BigDecimal("1.50"));
    task.estimate(new BigDecimal("1E+2"));
    assertThat(task.getEstimatedEffort()).isEqualByComparingTo("100");

    task.estimate(null);
    assertThat(task.getEstimatedEffort()).isNull();
  }

  @Test
  @DisplayName("estimate rejects zero, negatives, above 999 and a third decimal")
  void effortRules() {
    task.estimate(new BigDecimal("3"));

    assertEffortRejected("0");
    assertEffortRejected("0.00");
    assertEffortRejected("-1");
    assertEffortRejected("999.01");
    assertEffortRejected("1000");
    assertEffortRejected("1.005");
    assertEffortRejected("1E+400");
    assertThat(task.getEstimatedEffort()).isEqualByComparingTo("3");
  }

  @Test
  @DisplayName("priority, status and the blocked flag are independent")
  void priorityStatusBlocked() {
    task.prioritize(TaskPriority.P1);
    task.moveTo(TaskStatus.DONE);
    task.markBlocked(true);

    assertThat(task.getPriority()).isEqualTo(TaskPriority.P1);
    assertThat(task.getStatus()).isEqualTo(TaskStatus.DONE);
    assertThat(task.isBlocked()).isTrue();

    task.markBlocked(false);
    assertThat(task.isBlocked()).isFalse();
    assertThat(task.getStatus()).isEqualTo(TaskStatus.DONE);
  }
}
