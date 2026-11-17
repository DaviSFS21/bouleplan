package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  @Test
  @DisplayName("create trims the name and sets native origin")
  void createTrimsName() {
    Initiative initiative = Initiative.create(USER_ID, "  Study plan  ", InitiativeColor.BLUE);

    assertThat(initiative.getName()).isEqualTo("Study plan");
    assertThat(initiative.getUserId()).isEqualTo(USER_ID);
    assertThat(initiative.getColor()).isEqualTo(InitiativeColor.BLUE);
    assertThat(initiative.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(initiative.isActive()).isTrue();
  }

  @Test
  @DisplayName("create rejects a blank name")
  void createRejectsBlank() {
    assertThatThrownBy(() -> Initiative.create(USER_ID, "   ", InitiativeColor.BLUE))
        .isInstanceOf(InvalidInitiativeException.class);
  }

  @Test
  @DisplayName("create rejects a null name")
  void createRejectsNull() {
    assertThatThrownBy(() -> Initiative.create(USER_ID, null, InitiativeColor.BLUE))
        .isInstanceOf(InvalidInitiativeException.class);
  }

  @Test
  @DisplayName("create accepts a name of 200 characters")
  void createAccepts200() {
    String name = "a".repeat(200);

    assertThat(Initiative.create(USER_ID, name, InitiativeColor.BLUE).getName()).isEqualTo(name);
  }

  @Test
  @DisplayName("create rejects a name of 201 characters")
  void createRejects201() {
    String name = "a".repeat(201);

    assertThatThrownBy(() -> Initiative.create(USER_ID, name, InitiativeColor.BLUE))
        .isInstanceOf(InvalidInitiativeException.class);
  }

  @Test
  @DisplayName("the 200 character limit applies after trimming")
  void limitAppliesAfterTrim() {
    String name = " " + "a".repeat(200) + " ";

    assertThat(Initiative.create(USER_ID, name, InitiativeColor.BLUE).getName()).hasSize(200);
  }

  @Test
  @DisplayName("archive stamps archivedAt and makes the initiative inactive")
  void archiveMakesInactive() {
    Initiative initiative = Initiative.create(USER_ID, "Study plan", InitiativeColor.BLUE);

    initiative.archive();

    assertThat(initiative.getArchivedAt()).isBeforeOrEqualTo(OffsetDateTime.now());
    assertThat(initiative.isActive()).isFalse();
  }
}
