package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TaskEnumsTest {

  @Test
  @DisplayName("priority tokens round-trip and unknown ones are not found")
  void priority() {
    assertThat(TaskPriority.P1.getToken()).isEqualTo("P1");
    assertThat(TaskPriority.findByToken("P3")).contains(TaskPriority.P3);
    assertThat(TaskPriority.findByToken("p3")).isEmpty();
    assertThat(TaskPriority.findByToken(null)).isEmpty();
    assertThatThrownBy(() -> TaskPriority.fromToken("P9"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("status tokens round-trip and unknown ones are not found")
  void status() {
    assertThat(TaskStatus.TO_DO.getToken()).isEqualTo("to_do");
    assertThat(TaskStatus.IN_PROGRESS.getToken()).isEqualTo("in_progress");
    assertThat(TaskStatus.findByToken("done")).contains(TaskStatus.DONE);
    assertThat(TaskStatus.findByToken("DONE")).isEmpty();
    assertThat(TaskStatus.findByToken(null)).isEmpty();
    assertThatThrownBy(() -> TaskStatus.fromToken("x"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("the converters map to tokens and keep null")
  void converters() {
    TaskPriorityConverter priority = new TaskPriorityConverter();
    TaskStatusConverter status = new TaskStatusConverter();

    assertThat(priority.convertToDatabaseColumn(TaskPriority.P2)).isEqualTo("P2");
    assertThat(priority.convertToEntityAttribute("P1")).isEqualTo(TaskPriority.P1);
    assertThat(priority.convertToDatabaseColumn(null)).isNull();
    assertThat(priority.convertToEntityAttribute(null)).isNull();
    assertThat(status.convertToDatabaseColumn(TaskStatus.IN_PROGRESS)).isEqualTo("in_progress");
    assertThat(status.convertToEntityAttribute("done")).isEqualTo(TaskStatus.DONE);
    assertThat(status.convertToDatabaseColumn(null)).isNull();
    assertThat(status.convertToEntityAttribute(null)).isNull();
  }
}
