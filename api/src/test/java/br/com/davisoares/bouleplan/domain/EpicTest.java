package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EpicTest {

  private static final UUID INITIATIVE_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final String BLANK_CODE = "epic.name.blank";

  private final Epic epic = Epic.create(INITIATIVE_ID, "Design");

  private static String codeOf(String name) {
    return ((DomainRuleViolation) catchThrowable(() -> Epic.create(INITIATIVE_ID, name))).code();
  }

  @Test
  @DisplayName("create makes a native, active, named epic with a trimmed name")
  void create() {
    Epic created = Epic.create(INITIATIVE_ID, " ​Design  ");

    assertThat(created.getName()).isEqualTo("Design");
    assertThat(created.getInitiativeId()).isEqualTo(INITIATIVE_ID);
    assertThat(created.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(created.isImplicit()).isFalse();
    assertThat(created.isActive()).isTrue();
  }

  @Test
  @DisplayName("a blank or missing name has the code epic.name.blank")
  void blank() {
    assertThat(codeOf("  ")).isEqualTo(BLANK_CODE);
    assertThat(codeOf(null)).isEqualTo(BLANK_CODE);
    assertThat(codeOf("​﻿")).isEqualTo(BLANK_CODE);
  }

  @Test
  @DisplayName("a name over 200 characters has the code epic.name.too-long")
  void tooLong() {
    assertThat(codeOf("a".repeat(201))).isEqualTo("epic.name.too-long");
    assertThat(Epic.create(INITIATIVE_ID, "a".repeat(200)).getName()).hasSize(200);
  }

  @Test
  @DisplayName("control characters have the code epic.name.invalid-characters")
  void invalidCharacters() {
    assertThat(codeOf("a\nb")).isEqualTo("epic.name.invalid-characters");
    assertThat(codeOf("a\u0000b")).isEqualTo("epic.name.invalid-characters");
  }

  @Test
  @DisplayName("the violation is an InvalidEpicException with a message")
  void violationType() {
    Throwable thrown = catchThrowable(() -> Epic.create(INITIATIVE_ID, ""));

    assertThat(thrown).isInstanceOf(InvalidEpicException.class).hasMessageContaining("Epic name");
  }

  @Test
  @DisplayName("rename applies the same rules as creation")
  void rename() {
    epic.rename("  Build ");

    assertThat(epic.getName()).isEqualTo("Build");
    assertThat(catchThrowable(() -> epic.rename(" "))).isInstanceOf(InvalidEpicException.class);
    assertThat(epic.getName()).isEqualTo("Build");
  }

  @Test
  @DisplayName("createImplicit makes a nameless implicit epic")
  void implicit() {
    Epic implicit = Epic.createImplicit(INITIATIVE_ID);

    assertThat(implicit.isImplicit()).isTrue();
    assertThat(implicit.getName()).isNull();
    assertThat(implicit.getOrigin()).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(implicit.isActive()).isTrue();
  }
}
