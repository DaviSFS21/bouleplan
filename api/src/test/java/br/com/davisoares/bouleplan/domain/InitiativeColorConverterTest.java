package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeColorConverterTest {

  @Test
  @DisplayName("converter maps to the token and back, and passes null through")
  void converterRoundTrip() {
    InitiativeColorConverter converter = new InitiativeColorConverter();

    assertThat(converter.convertToDatabaseColumn(InitiativeColor.PURPLE)).isEqualTo("roxo");
    assertThat(converter.convertToEntityAttribute("roxo")).isEqualTo(InitiativeColor.PURPLE);
    assertThat(converter.convertToDatabaseColumn(null)).isNull();
    assertThat(converter.convertToEntityAttribute(null)).isNull();
  }

  @Test
  @DisplayName("converter rejects an unknown token")
  void converterRejectsUnknown() {
    InitiativeColorConverter converter = new InitiativeColorConverter();

    assertThatThrownBy(() -> converter.convertToEntityAttribute("ciano"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
