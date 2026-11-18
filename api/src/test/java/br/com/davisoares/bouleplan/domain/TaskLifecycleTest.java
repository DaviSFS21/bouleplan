package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TaskLifecycleTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

  private final Task task =
      Task.create(Epic.create(INITIATIVE_ID, "Design"), "Write", TaskStatus.TO_DO);

  @Test
  @DisplayName("archive stamps only archivedAt in UTC and is idempotent")
  void archive() {
    task.archive();
    OffsetDateTime first = task.getArchivedAt();
    task.archive();

    assertThat(first).isNotNull();
    assertThat(first.getOffset()).isEqualTo(ZoneOffset.UTC);
    assertThat(task.getArchivedAt()).isEqualTo(first);
    assertThat(task.isArchived()).isTrue();
    assertThat(task.isDeleted()).isFalse();
    assertThat(task.isActive()).isFalse();
  }

  @Test
  @DisplayName("unarchive clears archivedAt and is idempotent")
  void unarchive() {
    task.archive();
    task.unarchive();
    task.unarchive();

    assertThat(task.getArchivedAt()).isNull();
    assertThat(task.isActive()).isTrue();
  }

  @Test
  @DisplayName("softDelete stamps only deletedAt in UTC and is idempotent")
  void softDelete() {
    task.softDelete();
    OffsetDateTime first = task.getDeletedAt();
    task.softDelete();

    assertThat(first).isNotNull();
    assertThat(first.getOffset()).isEqualTo(ZoneOffset.UTC);
    assertThat(task.getDeletedAt()).isEqualTo(first);
    assertThat(task.isDeleted()).isTrue();
    assertThat(task.isArchived()).isFalse();
    assertThat(task.isActive()).isFalse();
  }

  @Test
  @DisplayName("restore clears deletedAt and leaves archivedAt alone")
  void restore() {
    task.archive();
    task.softDelete();
    task.restore();

    assertThat(task.isDeleted()).isFalse();
    assertThat(task.isArchived()).isTrue();
    assertThat(task.isActive()).isFalse();
  }
}
