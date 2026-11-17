package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeLifecycleTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final Initiative initiative = Initiative.create(USER_ID, "Study", InitiativeColor.BLUE);

  @Test
  @DisplayName("archive stamps only archivedAt and is idempotent")
  void archiveIdempotent() {
    initiative.archive();
    OffsetDateTime first = initiative.getArchivedAt();
    initiative.archive();

    assertThat(first).isNotNull();
    assertThat(initiative.getArchivedAt()).isEqualTo(first);
    assertThat(initiative.isArchived()).isTrue();
    assertThat(initiative.isDeleted()).isFalse();
    assertThat(initiative.getDeletedAt()).isNull();
  }

  @Test
  @DisplayName("unarchive clears archivedAt, keeps the color and is idempotent")
  void unarchive() {
    initiative.archive();
    initiative.unarchive();
    initiative.unarchive();

    assertThat(initiative.getArchivedAt()).isNull();
    assertThat(initiative.isActive()).isTrue();
    assertThat(initiative.getColor()).isEqualTo(InitiativeColor.BLUE);
  }

  @Test
  @DisplayName("softDelete stamps only deletedAt and is idempotent")
  void deleteIdempotent() {
    initiative.softDelete();
    OffsetDateTime first = initiative.getDeletedAt();
    initiative.softDelete();

    assertThat(first).isNotNull();
    assertThat(initiative.getDeletedAt()).isEqualTo(first);
    assertThat(initiative.isDeleted()).isTrue();
    assertThat(initiative.isActive()).isFalse();
    assertThat(initiative.getArchivedAt()).isNull();
  }

  @Test
  @DisplayName("restore clears deletedAt, keeps archivedAt and is idempotent")
  void restore() {
    initiative.archive();
    initiative.softDelete();
    initiative.restore();
    initiative.restore();

    assertThat(initiative.getDeletedAt()).isNull();
    assertThat(initiative.isArchived()).isTrue();
    assertThat(initiative.getColor()).isEqualTo(InitiativeColor.BLUE);
  }
}
