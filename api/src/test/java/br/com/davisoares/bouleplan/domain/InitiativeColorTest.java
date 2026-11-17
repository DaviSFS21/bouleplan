package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeColorTest {

  @Test
  @DisplayName("suggests yellow when no color is in use")
  void suggestsYellowWhenEmpty() {
    assertThat(InitiativeColor.suggestNext(List.of())).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("suggests the first unused color in palette order")
  void suggestsFirstUnused() {
    List<InitiativeColor> inUse = List.of(InitiativeColor.YELLOW, InitiativeColor.LIME);

    assertThat(InitiativeColor.suggestNext(inUse)).isEqualTo(InitiativeColor.GREEN);
  }

  @Test
  @DisplayName("skips a gap and picks the earliest unused color")
  void picksEarliestUnusedAfterGap() {
    List<InitiativeColor> inUse = List.of(InitiativeColor.YELLOW, InitiativeColor.GREEN);

    assertThat(InitiativeColor.suggestNext(inUse)).isEqualTo(InitiativeColor.LIME);
  }

  @Test
  @DisplayName("cycles back to yellow when all eight colors are used once")
  void cyclesWhenAllUsedOnce() {
    List<InitiativeColor> inUse = List.of(InitiativeColor.values());

    assertThat(InitiativeColor.suggestNext(inUse)).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("prefers the least-used color when every color is used")
  void prefersLeastUsed() {
    List<InitiativeColor> inUse = new ArrayList<>(List.of(InitiativeColor.values()));
    inUse.add(InitiativeColor.YELLOW);
    inUse.add(InitiativeColor.LIME);

    assertThat(InitiativeColor.suggestNext(inUse)).isEqualTo(InitiativeColor.GREEN);
  }

  @Test
  @DisplayName("breaks ties by palette order")
  void breaksTiesByPaletteOrder() {
    List<InitiativeColor> inUse =
        List.of(InitiativeColor.BLUE, InitiativeColor.BLUE, InitiativeColor.PINK);

    assertThat(InitiativeColor.suggestNext(inUse)).isEqualTo(InitiativeColor.YELLOW);
  }

  @Test
  @DisplayName("exposes the token name stored in the database")
  void exposesToken() {
    assertThat(InitiativeColor.TURQUOISE.getToken()).isEqualTo("turquesa");
  }

  @Test
  @DisplayName("resolves every token back to its color")
  void fromTokenRoundTrip() {
    for (InitiativeColor color : InitiativeColor.values()) {
      assertThat(InitiativeColor.fromToken(color.getToken())).isEqualTo(color);
    }
  }

  @Test
  @DisplayName("rejects an unknown token")
  void fromTokenRejectsUnknown() {
    assertThatThrownBy(() -> InitiativeColor.fromToken("#ff0000"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
