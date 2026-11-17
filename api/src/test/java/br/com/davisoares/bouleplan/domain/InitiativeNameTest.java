package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeNameTest {

  private static final String BLANK = "initiative.name.blank";

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private static String codeOf(String name) {
    return ((DomainRuleViolation)
            catchThrowable(() -> Initiative.create(USER_ID, name, InitiativeColor.BLUE)))
        .code();
  }

  private static Throwable catchThrowable(Runnable action) {
    return org.assertj.core.api.Assertions.catchThrowable(action::run);
  }

  @Test
  @DisplayName("a blank name has the code initiative.name.blank")
  void blankCode() {
    assertThat(codeOf("  ")).isEqualTo(BLANK);
    assertThat(codeOf(null)).isEqualTo(BLANK);
  }

  @Test
  @DisplayName("a name of only no-break or invisible characters is blank")
  void invisibleOnlyIsBlank() {
    assertThat(codeOf("  ")).isEqualTo(BLANK);
    assertThat(codeOf("​‌‍﻿")).isEqualTo(BLANK);
    assertThat(codeOf("    ")).isEqualTo(BLANK);
  }

  @Test
  @DisplayName("create trims no-break spaces and zero-width characters at the edges")
  void trimsInvisibleEdges() {
    Initiative initiative = Initiative.create(USER_ID, " ​Study plan﻿ ", InitiativeColor.BLUE);

    assertThat(initiative.getName()).isEqualTo("Study plan");
  }

  @Test
  @DisplayName("control characters are rejected with initiative.name.invalid-characters")
  void controlCharacters() {
    assertThat(codeOf("a\u0000b")).isEqualTo("initiative.name.invalid-characters");
    assertThat(codeOf("\u0000")).isEqualTo("initiative.name.invalid-characters");
    assertThat(codeOf("line\nbreak")).isEqualTo("initiative.name.invalid-characters");
  }

  @Test
  @DisplayName("a too long name has the code initiative.name.too-long")
  void tooLongCode() {
    assertThat(codeOf("a".repeat(201))).isEqualTo("initiative.name.too-long");
  }

  @Test
  @DisplayName("a violation is a DomainRuleViolation carrying its message")
  void violationMessage() {
    assertThatThrownBy(() -> Initiative.create(USER_ID, " ", InitiativeColor.BLUE))
        .isInstanceOf(DomainRuleViolation.class)
        .hasMessageContaining("blank");
  }
}
