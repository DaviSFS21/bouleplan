package br.com.davisoares.bouleplan.domain;

import java.util.Arrays;
import java.util.Optional;

/** Task priority, P1 first. */
public enum TaskPriority {
  P1("P1"),
  P2("P2"),
  P3("P3");

  private final String token;

  TaskPriority(String token) {
    this.token = token;
  }

  /** The token stored in the database and exposed by the API. */
  public String getToken() {
    return token;
  }

  /** Resolves a stored token; fails on an unknown one. */
  public static TaskPriority fromToken(String token) {
    return findByToken(token)
        .orElseThrow(() -> new IllegalArgumentException("Unknown priority token: " + token));
  }

  /** Resolves a token, empty if unknown. */
  public static Optional<TaskPriority> findByToken(String token) {
    return Arrays.stream(values()).filter(priority -> priority.token.equals(token)).findFirst();
  }
}
