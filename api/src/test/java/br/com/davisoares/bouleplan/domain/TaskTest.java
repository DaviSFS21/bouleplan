package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TaskTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final String BLANK_CODE = "task.title.blank";

  private final Epic epic = Epic.create(INITIATIVE_ID, "Design");

  private String codeOf(String title) {
    Throwable thrown = catchThrowable(() -> Task.create(epic, title, TaskStatus.TO_DO));
    assertThat(thrown).isInstanceOf(InvalidTaskException.class);
    return ((DomainRuleViolation) thrown).code();
  }

  @Test
  @DisplayName("create makes a native, active, unblocked P2 task with a trimmed title")
  void create() {
    Task task = Task.create(epic, " ​Write the plan  ", TaskStatus.TO_DO);

    assertThat(task.getTitle()).isEqualTo("Write the plan");
    assertThat(task.getEpic()).isSameAs(epic);
    assertThat(task.getPriority()).isEqualTo(TaskPriority.P2);
    assertThat(task.getStatus()).isEqualTo(TaskStatus.TO_DO);
    assertThat(task.isBlocked()).isFalse();
    assertThat(task.getDescription()).isNull();
    assertThat(task.getDeadline()).isNull();
    assertThat(task.getEstimatedEffort()).isNull();
    assertThat(task.getPlannedWeekStart()).isNull();
    assertThat(task.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(task.isActive()).isTrue();
  }

  @Test
  @DisplayName("create starts in the given status, and a missing one means to_do")
  void createStatus() {
    assertThat(Task.create(epic, "A", TaskStatus.DONE).getStatus()).isEqualTo(TaskStatus.DONE);
    assertThat(Task.create(epic, "A", null).getStatus()).isEqualTo(TaskStatus.TO_DO);
  }

  @Test
  @DisplayName("a blank or missing title has the code task.title.blank")
  void blank() {
    assertThat(codeOf("  ")).isEqualTo(BLANK_CODE);
    assertThat(codeOf(null)).isEqualTo(BLANK_CODE);
    assertThat(codeOf("​﻿")).isEqualTo(BLANK_CODE);
  }

  @Test
  @DisplayName("a title over 300 characters has the code task.title.too-long")
  void tooLong() {
    assertThat(codeOf("a".repeat(301))).isEqualTo("task.title.too-long");
    assertThat(Task.create(epic, "a".repeat(300), null).getTitle()).hasSize(300);
  }

  @Test
  @DisplayName("control characters have the code task.title.invalid-characters")
  void invalidCharacters() {
    assertThat(codeOf("a\nb")).isEqualTo("task.title.invalid-characters");
    assertThat(codeOf("a\u0000b")).isEqualTo("task.title.invalid-characters");
  }

  @Test
  @DisplayName("the violation message talks about the title")
  void message() {
    assertThat(catchThrowable(() -> Task.create(epic, "", null)))
        .hasMessageContaining("Task title");
  }
}
