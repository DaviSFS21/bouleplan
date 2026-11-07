package br.com.davisoares.bouleplan.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class InitiativeOriginTest {

  @Test
  @DisplayName("converter maps to the token and back, and passes null through")
  void converterRoundTrip() {
    InitiativeOriginConverter converter = new InitiativeOriginConverter();

    assertThat(converter.convertToDatabaseColumn(InitiativeOrigin.NATIVE)).isEqualTo("native");
    assertThat(converter.convertToEntityAttribute("native")).isEqualTo(InitiativeOrigin.NATIVE);
    assertThat(converter.convertToDatabaseColumn(null)).isNull();
    assertThat(converter.convertToEntityAttribute(null)).isNull();
  }

  @Test
  @DisplayName("converter rejects an unknown token")
  void converterRejectsUnknown() {
    InitiativeOriginConverter converter = new InitiativeOriginConverter();

    assertThatThrownBy(() -> converter.convertToEntityAttribute("mirrored"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
