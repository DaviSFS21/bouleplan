package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PhaseLifecycleTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

  private final Phase phase = Phase.create(INITIATIVE_ID, "Design");

  @Test
  @DisplayName("archive stamps only archivedAt in UTC and is idempotent")
  void archive() {
    phase.archive();
    OffsetDateTime first = phase.getArchivedAt();
    phase.archive();

    assertThat(first).isNotNull();
    assertThat(first.getOffset()).isEqualTo(ZoneOffset.UTC);
    assertThat(phase.getArchivedAt()).isEqualTo(first);
    assertThat(phase.isArchived()).isTrue();
    assertThat(phase.isDeleted()).isFalse();
    assertThat(phase.isActive()).isFalse();
  }

  @Test
  @DisplayName("unarchive clears archivedAt and is idempotent")
  void unarchive() {
    phase.archive();
    phase.unarchive();
    phase.unarchive();

    assertThat(phase.getArchivedAt()).isNull();
    assertThat(phase.isActive()).isTrue();
  }

  @Test
  @DisplayName("softDelete stamps only deletedAt in UTC and is idempotent")
  void softDelete() {
    phase.softDelete();
    OffsetDateTime first = phase.getDeletedAt();
    phase.softDelete();

    assertThat(first).isNotNull();
    assertThat(first.getOffset()).isEqualTo(ZoneOffset.UTC);
    assertThat(phase.getDeletedAt()).isEqualTo(first);
    assertThat(phase.isDeleted()).isTrue();
    assertThat(phase.getArchivedAt()).isNull();
    assertThat(phase.isActive()).isFalse();
  }

  @Test
  @DisplayName("restore clears deletedAt and is idempotent")
  void restore() {
    phase.softDelete();
    phase.restore();
    phase.restore();

    assertThat(phase.getDeletedAt()).isNull();
    assertThat(phase.isActive()).isTrue();
  }
}
