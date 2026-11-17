package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeEditingTest {

  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private final Initiative initiative = Initiative.create(USER_ID, "Study", InitiativeColor.BLUE);

  private static void assertCode(Runnable action, String code) {
    assertThatThrownBy(action::run)
        .isInstanceOf(InvalidInitiativeException.class)
        .extracting(e -> ((InvalidInitiativeException) e).code())
        .isEqualTo(code);
  }

  @Test
  @DisplayName("rename trims the name")
  void renameTrims() {
    initiative.rename("  New name ");

    assertThat(initiative.getName()).isEqualTo("New name");
  }

  @Test
  @DisplayName("rename applies the creation rules")
  void renameRules() {
    assertCode(() -> initiative.rename(null), "initiative.name.blank");
    assertCode(() -> initiative.rename("  "), "initiative.name.blank");
    assertCode(() -> initiative.rename("a".repeat(201)), "initiative.name.too-long");
    assertCode(() -> initiative.rename("a\nb"), "initiative.name.invalid-characters");
    assertThat(initiative.getName()).isEqualTo("Study");
  }

  @Test
  @DisplayName("describe trims and keeps inner newlines and tabs")
  void describeKeepsNewlines() {
    initiative.describe("  line one\n\tline two \n");

    assertThat(initiative.getDescription()).isEqualTo("line one\n\tline two");
  }

  @Test
  @DisplayName("describe turns blank or null into null")
  void describeBlankClears() {
    initiative.describe("text");
    initiative.describe(" \n ");
    assertThat(initiative.getDescription()).isNull();

    initiative.describe("text");
    initiative.describe(null);
    assertThat(initiative.getDescription()).isNull();
  }

  @Test
  @DisplayName("describe accepts 10000 characters and rejects 10001")
  void describeLimit() {
    initiative.describe("a".repeat(10_000));
    assertThat(initiative.getDescription()).hasSize(10_000);

    assertCode(() -> initiative.describe("a".repeat(10_001)), "initiative.description.too-long");
  }

  @Test
  @DisplayName("describe rejects control characters other than newline and tab")
  void describeControlCharacters() {
    assertCode(() -> initiative.describe("a\u0000b"), "initiative.description.invalid-characters");
    assertCode(() -> initiative.describe("a\ud800b"), "initiative.description.invalid-characters");
  }

  @Test
  @DisplayName("describe normalizes CRLF and lone CR to LF")
  void describeNormalizesLineEndings() {
    initiative.describe("a\r\nb");
    assertThat(initiative.getDescription()).isEqualTo("a\nb");

    initiative.describe("a\rb\r\n\rc");
    assertThat(initiative.getDescription()).isEqualTo("a\nb\n\nc");
  }

  @Test
  @DisplayName("recolor changes the color and rejects null")
  void recolor() {
    initiative.recolor(InitiativeColor.PINK);
    assertThat(initiative.getColor()).isEqualTo(InitiativeColor.PINK);

    assertCode(() -> initiative.recolor(null), "initiative.color.required");
    assertThat(initiative.getColor()).isEqualTo(InitiativeColor.PINK);
  }
}
