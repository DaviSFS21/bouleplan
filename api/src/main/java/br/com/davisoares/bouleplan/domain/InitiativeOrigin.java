package br.com.davisoares.bouleplan.domain;

/** Where an initiative comes from. Mirrored origins will extend this later. */
public enum InitiativeOrigin {
  NATIVE("native");

  private final String token;

  InitiativeOrigin(String token) {
    this.token = token;
  }

  /** The token stored in the database. */
  public String getToken() {
    return token;
  }

  /** Resolves a stored token; fails on an unknown one. */
  public static InitiativeOrigin fromToken(String token) {
    for (InitiativeOrigin origin : values()) {
      if (origin.token.equals(token)) {
        return origin;
      }
    }
    throw new IllegalArgumentException("Unknown origin token: " + token);
  }
}
