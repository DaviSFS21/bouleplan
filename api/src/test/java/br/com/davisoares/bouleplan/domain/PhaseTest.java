package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PhaseTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final String BLANK_CODE = "phase.name.blank";

  private final Phase phase = Phase.create(INITIATIVE_ID, "Design");

  private static String codeOf(String name) {
    return ((DomainRuleViolation) catchThrowable(() -> Phase.create(INITIATIVE_ID, name))).code();
  }

  @Test
  @DisplayName("create makes a native, active, named phase with a trimmed name")
  void create() {
    Phase created = Phase.create(INITIATIVE_ID, " ​Design  ");

    assertThat(created.getName()).isEqualTo("Design");
    assertThat(created.getInitiativeId()).isEqualTo(INITIATIVE_ID);
    assertThat(created.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(created.isImplicit()).isFalse();
    assertThat(created.isActive()).isTrue();
  }

  @Test
  @DisplayName("a blank or missing name has the code phase.name.blank")
  void blank() {
    assertThat(codeOf("  ")).isEqualTo(BLANK_CODE);
    assertThat(codeOf(null)).isEqualTo(BLANK_CODE);
    assertThat(codeOf("​﻿")).isEqualTo(BLANK_CODE);
  }

  @Test
  @DisplayName("a name over 200 characters has the code phase.name.too-long")
  void tooLong() {
    assertThat(codeOf("a".repeat(201))).isEqualTo("phase.name.too-long");
    assertThat(Phase.create(INITIATIVE_ID, "a".repeat(200)).getName()).hasSize(200);
  }

  @Test
  @DisplayName("control characters have the code phase.name.invalid-characters")
  void invalidCharacters() {
    assertThat(codeOf("a\nb")).isEqualTo("phase.name.invalid-characters");
    assertThat(codeOf("a\u0000b")).isEqualTo("phase.name.invalid-characters");
  }

  @Test
  @DisplayName("the violation is an InvalidPhaseException with a message")
  void violationType() {
    Throwable thrown = catchThrowable(() -> Phase.create(INITIATIVE_ID, ""));

    assertThat(thrown).isInstanceOf(InvalidPhaseException.class).hasMessageContaining("Phase name");
  }

  @Test
  @DisplayName("rename applies the same rules as creation")
  void rename() {
    phase.rename("  Build ");

    assertThat(phase.getName()).isEqualTo("Build");
    assertThat(catchThrowable(() -> phase.rename(" "))).isInstanceOf(InvalidPhaseException.class);
    assertThat(phase.getName()).isEqualTo("Build");
  }

  @Test
  @DisplayName("createImplicit makes a nameless implicit phase")
  void implicit() {
    Phase implicit = Phase.createImplicit(INITIATIVE_ID);

    assertThat(implicit.isImplicit()).isTrue();
    assertThat(implicit.getName()).isNull();
    assertThat(implicit.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(implicit.isActive()).isTrue();
  }
}
