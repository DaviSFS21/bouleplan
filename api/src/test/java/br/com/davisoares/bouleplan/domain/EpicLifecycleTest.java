package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EpicLifecycleTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

  private final Epic epic = Epic.create(INITIATIVE_ID, "Design");

  @Test
  @DisplayName("archive stamps only archivedAt in UTC and is idempotent")
  void archive() {
    epic.archive();
    OffsetDateTime first = epic.getArchivedAt();
    epic.archive();

    assertThat(first).isNotNull();
    assertThat(first.getOffset()).isEqualTo(ZoneOffset.UTC);
    assertThat(epic.getArchivedAt()).isEqualTo(first);
    assertThat(epic.isArchived()).isTrue();
    assertThat(epic.isDeleted()).isFalse();
    assertThat(epic.isActive()).isFalse();
  }

  @Test
  @DisplayName("unarchive clears archivedAt and is idempotent")
  void unarchive() {
    epic.archive();
    epic.unarchive();
    epic.unarchive();

    assertThat(epic.getArchivedAt()).isNull();
    assertThat(epic.isActive()).isTrue();
  }

  @Test
  @DisplayName("softDelete stamps only deletedAt in UTC and is idempotent")
  void softDelete() {
    epic.softDelete();
    OffsetDateTime first = epic.getDeletedAt();
    epic.softDelete();

    assertThat(first).isNotNull();
    assertThat(first.getOffset()).isEqualTo(ZoneOffset.UTC);
    assertThat(epic.getDeletedAt()).isEqualTo(first);
    assertThat(epic.isDeleted()).isTrue();
    assertThat(epic.getArchivedAt()).isNull();
    assertThat(epic.isActive()).isFalse();
  }

  @Test
  @DisplayName("restore clears deletedAt and is idempotent")
  void restore() {
    epic.softDelete();
    epic.restore();
    epic.restore();

    assertThat(epic.getDeletedAt()).isNull();
    assertThat(epic.isActive()).isTrue();
  }
}
