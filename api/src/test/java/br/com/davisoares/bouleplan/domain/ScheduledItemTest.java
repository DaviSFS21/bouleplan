package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ScheduledItemTest {

  private static final UUID TASK_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final LocalDate DAY = LocalDate.of(2026, 11, 17);
  private static final LocalTime NINE = LocalTime.of(9, 0);
  private static final LocalTime TEN = LocalTime.of(10, 0);
  private static final String TIME_INVALID = "scheduled-item.time.invalid";

  private static String codeOf(Runnable action) {
    return ((DomainRuleViolation) catchThrowable(action::run)).code();
  }

  @Test
  @DisplayName("a day-list entry has an order and no times")
  void dayListEntry() {
    ScheduledItem item = ScheduledItem.dayListEntry(TASK_ID, DAY, 3);

    assertThat(item.getTaskId()).isEqualTo(TASK_ID);
    assertThat(item.getDate()).isEqualTo(DAY);
    assertThat(item.getSortOrder()).isEqualTo(3);
    assertThat(item.getStartTime()).isNull();
    assertThat(item.getEndTime()).isNull();
    assertThat(item.isBlock()).isFalse();
  }

  @Test
  @DisplayName("a block has two times, no order and a duration in minutes")
  void block() {
    ScheduledItem item = ScheduledItem.block(TASK_ID, DAY, NINE, LocalTime.of(10, 45));

    assertThat(item.getStartTime()).isEqualTo(NINE);
    assertThat(item.getEndTime()).isEqualTo(LocalTime.of(10, 45));
    assertThat(item.getSortOrder()).isNull();
    assertThat(item.isBlock()).isTrue();
    assertThat(item.durationMinutes()).isEqualTo(105);
  }

  @Test
  @DisplayName("block times are quarter hours, start before end, on a valid date")
  void blockRules() {
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, DAY, NINE, NINE))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, DAY, TEN, NINE))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, DAY, LocalTime.of(9, 5), TEN)))
        .isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, DAY, NINE, LocalTime.of(10, 0, 30))))
        .isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, DAY, null, TEN))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, DAY, NINE, null))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, null, NINE, TEN))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.block(TASK_ID, LocalDate.of(0, 1, 1), NINE, TEN)))
        .isEqualTo(TIME_INVALID);
  }

  @Test
  @DisplayName("a day-list entry needs a date and a non-negative order")
  void dayListRules() {
    assertThat(codeOf(() -> ScheduledItem.dayListEntry(TASK_ID, null, 0))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> ScheduledItem.dayListEntry(TASK_ID, DAY, -1))).isEqualTo(TIME_INVALID);
  }

  @Test
  @DisplayName("an entry turns into a block and back, clearing what the other kind does not have")
  void turnsIntoOtherKind() {
    ScheduledItem item = ScheduledItem.dayListEntry(TASK_ID, DAY, 0);

    item.placeAsBlock(DAY.plusDays(1), NINE, TEN);

    assertThat(item.isBlock()).isTrue();
    assertThat(item.getDate()).isEqualTo(DAY.plusDays(1));
    assertThat(item.getSortOrder()).isNull();

    item.placeInDayList(DAY, 4);

    assertThat(item.isBlock()).isFalse();
    assertThat(item.getStartTime()).isNull();
    assertThat(item.getEndTime()).isNull();
    assertThat(item.getSortOrder()).isEqualTo(4);
  }

  @Test
  @DisplayName("a refused placement leaves the item untouched")
  void refusedPlacement() {
    ScheduledItem item = ScheduledItem.block(TASK_ID, DAY, NINE, TEN);

    assertThat(codeOf(() -> item.placeAsBlock(DAY, TEN, NINE))).isEqualTo(TIME_INVALID);
    assertThat(codeOf(() -> item.placeInDayList(DAY, -2))).isEqualTo(TIME_INVALID);

    assertThat(item.getStartTime()).isEqualTo(NINE);
    assertThat(item.getEndTime()).isEqualTo(TEN);
    assertThat(item.getSortOrder()).isNull();
  }
}
