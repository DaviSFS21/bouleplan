package br.com.davisoares.bouleplan.domain;

import java.time.LocalDate;
import java.util.function.BiFunction;

/** Text rules shared by the entities. */
final class EntityText {

  static final int MAX_NAME_LENGTH = 200;
  static final int MAX_DESCRIPTION_LENGTH = 10_000;
  static final int MIN_DEADLINE_YEAR = 1;
  static final int MAX_DEADLINE_YEAR = 9999;

  private EntityText() {}

  /**
   * Trims and validates a name; {@code violation} builds the exception from a code and a message.
   */
  static String validName(
      String name,
      String subject,
      String codePrefix,
      BiFunction<String, String, ? extends DomainRuleViolation> violation) {
    return validText(name, subject + " name", codePrefix, MAX_NAME_LENGTH, violation);
  }

  /** Trims and validates a single-line text of at most {@code maxLength} characters. */
  static String validText(
      String text,
      String label,
      String codePrefix,
      int maxLength,
      BiFunction<String, String, ? extends DomainRuleViolation> violation) {
    String trimmed = text == null ? "" : stripInvisible(text);
    if (trimmed.isEmpty()) {
      throw violation.apply(codePrefix + ".blank", label + " must not be blank");
    }
    if (trimmed.codePoints().anyMatch(EntityText::isInvalidCodePoint)) {
      throw violation.apply(
          codePrefix + ".invalid-characters",
          label + " must not contain control or invalid characters");
    }
    if (trimmed.length() > maxLength) {
      throw violation.apply(
          codePrefix + ".too-long", label + " must have at most " + maxLength + " characters");
    }
    return trimmed;
  }

  /**
   * Normalizes line breaks, trims and validates a multi-line description; blank becomes {@code
   * null}.
   */
  static String validDescription(
      String description,
      String subject,
      String codePrefix,
      BiFunction<String, String, ? extends DomainRuleViolation> violation) {
    String trimmed =
        description == null
            ? ""
            : stripInvisible(description.replace("\r\n", "\n").replace('\r', '\n'));
    if (trimmed.codePoints().anyMatch(EntityText::isInvalidDescriptionCodePoint)) {
      throw violation.apply(
          codePrefix + ".invalid-characters",
          subject + " description must not contain control or invalid characters");
    }
    if (trimmed.length() > MAX_DESCRIPTION_LENGTH) {
      throw violation.apply(
          codePrefix + ".too-long",
          subject + " description must have at most " + MAX_DESCRIPTION_LENGTH + " characters");
    }
    return trimmed.isEmpty() ? null : trimmed;
  }

  static boolean hasValidYear(LocalDate date) {
    return date.getYear() >= MIN_DEADLINE_YEAR && date.getYear() <= MAX_DEADLINE_YEAR;
  }

  private static boolean isInvalidDescriptionCodePoint(int codePoint) {
    return codePoint != '\n' && codePoint != '\t' && isInvalidCodePoint(codePoint);
  }

  static boolean isInvalidCodePoint(int codePoint) {
    return Character.isISOControl(codePoint) || Character.getType(codePoint) == Character.SURROGATE;
  }

  static String stripInvisible(String value) {
    int start = 0;
    int end = value.length();
    while (start < end && isInvisible(value.charAt(start))) {
      start++;
    }
    while (end > start && isInvisible(value.charAt(end - 1))) {
      end--;
    }
    return value.substring(start, end);
  }

  private static boolean isInvisible(char c) {
    return Character.isWhitespace(c)
        || Character.isSpaceChar(c)
        || Character.getType(c) == Character.FORMAT
        || c == 0x2800
        || c == 0x3164
        || c == 0x115F
        || c == 0x1160
        || c == 0xFFA0;
  }
}
