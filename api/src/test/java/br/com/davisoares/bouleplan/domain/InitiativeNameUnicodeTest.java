package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeNameUnicodeTest {

  private static final String BLANK = "initiative.name.blank";
  private static final String INVALID = "initiative.name.invalid-characters";
  private static final UUID USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

  private static String codeOf(String name) {
    return ((DomainRuleViolation)
            catchThrowable(() -> Initiative.create(USER_ID, name, InitiativeColor.BLUE)))
        .code();
  }

  @Test
  @DisplayName("a name of only format characters or blank letters is blank")
  void formatAndBlankLettersAreBlank() {
    assertThat(codeOf("\u200E")).isEqualTo(BLANK); // left-to-right mark
    assertThat(codeOf("\u00AD")).isEqualTo(BLANK); // soft hyphen
    assertThat(codeOf("\u2800")).isEqualTo(BLANK); // braille blank
    assertThat(codeOf("\u3164")).isEqualTo(BLANK); // hangul filler
    assertThat(codeOf("\u115F\u1160\uFFA0")).isEqualTo(BLANK); // hangul fillers
  }

  @Test
  @DisplayName("an unpaired surrogate is rejected with initiative.name.invalid-characters")
  void unpairedSurrogate() {
    assertThat(codeOf("a\uD83Db")).isEqualTo(INVALID); // lone high surrogate
    assertThat(codeOf("\uDE00")).isEqualTo(INVALID); // lone low surrogate
  }

  @Test
  @DisplayName("joiners inside an emoji sequence are kept")
  void keepsInnerJoiners() {
    String family = "\uD83D\uDC69\u200D\uD83D\uDC67"; // woman, joiner, girl

    assertThat(Initiative.create(USER_ID, family, InitiativeColor.BLUE).getName())
        .isEqualTo(family);
  }
}
