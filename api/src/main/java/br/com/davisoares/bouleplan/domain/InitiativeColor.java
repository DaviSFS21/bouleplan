package br.com.davisoares.bouleplan.domain;

import java.util.Collection;
import java.util.Collections;

/** Palette tokens, in palette order. The token name is stored, never a hex value. */
public enum InitiativeColor {
  YELLOW("amarelo"),
  LIME("lima"),
  GREEN("verde"),
  TURQUOISE("turquesa"),
  BLUE("azul"),
  PURPLE("roxo"),
  PINK("rosa"),
  BROWN("marrom");

  private final String token;

  InitiativeColor(String token) {
    this.token = token;
  }

  /** The token name stored in the database and exposed by the API. */
  public String getToken() {
    return token;
  }

  /** Resolves a stored token; fails on an unknown one. */
  public static InitiativeColor fromToken(String token) {
    for (InitiativeColor color : values()) {
      if (color.token.equals(token)) {
        return color;
      }
    }
    throw new IllegalArgumentException("Unknown color token: " + token);
  }

  /** Least-used color among {@code inUse}; ties go to palette order, so colors cycle. */
  public static InitiativeColor suggestNext(Collection<InitiativeColor> inUse) {
    InitiativeColor best = YELLOW;
    for (InitiativeColor color : values()) {
      if (Collections.frequency(inUse, color) < Collections.frequency(inUse, best)) {
        best = color;
      }
    }
    return best;
  }
}
