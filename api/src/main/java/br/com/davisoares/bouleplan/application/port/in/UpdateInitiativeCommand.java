package br.com.davisoares.bouleplan.application.port.in;

import java.time.LocalDate;

/** Partial update: an absent change leaves the field alone, a present {@code null} clears it. */
public record UpdateInitiativeCommand(
    Change<String> name,
    Change<String> description,
    Change<LocalDate> overallDeadline,
    Change<String> color) {

  /** A field that is either absent or present with a (possibly {@code null}) value. */
  public record Change<T>(boolean present, T value) {

    /** The field was not sent. */
    public static <T> Change<T> absent() {
      return new Change<>(false, null);
    }

    /** The field was sent with this value, possibly {@code null}. */
    public static <T> Change<T> of(T value) {
      return new Change<>(true, value);
    }
  }
}
