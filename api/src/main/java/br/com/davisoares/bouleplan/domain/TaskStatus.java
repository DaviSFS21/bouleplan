package br.com.davisoares.bouleplan.domain;

import java.util.Arrays;
import java.util.Optional;

/** Where a task stands in the kanban, independent of whether it is blocked. */
public enum TaskStatus {
  TO_DO("to_do"),
  IN_PROGRESS("in_progress"),
  DONE("done");

  private final String token;

  TaskStatus(String token) {
    this.token = token;
  }

  /** The token stored in the database and exposed by the API. */
  public String getToken() {
    return token;
  }

  /** Resolves a stored token; fails on an unknown one. */
  public static TaskStatus fromToken(String token) {
    return findByToken(token)
        .orElseThrow(() -> new IllegalArgumentException("Unknown status token: " + token));
  }

  /** Resolves a token, empty if unknown. */
  public static Optional<TaskStatus> findByToken(String token) {
    return Arrays.stream(values()).filter(status -> status.token.equals(token)).findFirst();
  }
}
