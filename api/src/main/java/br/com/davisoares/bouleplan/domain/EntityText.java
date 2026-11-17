package br.com.davisoares.bouleplan.domain;

import java.util.function.BiFunction;

/** Text rules shared by the entities. */
final class EntityText {

  static final int MAX_NAME_LENGTH = 200;

  private EntityText() {}

  /**
   * Trims and validates a name; {@code violation} builds the exception from a code and a message.
   */
  static String validName(
      String name,
      String subject,
      String codePrefix,
      BiFunction<String, String, ? extends DomainRuleViolation> violation) {
    String trimmed = name == null ? "" : stripInvisible(name);
    if (trimmed.isEmpty()) {
      throw violation.apply(codePrefix + ".blank", subject + " name must not be blank");
    }
    if (trimmed.codePoints().anyMatch(EntityText::isInvalidCodePoint)) {
      throw violation.apply(
          codePrefix + ".invalid-characters",
          subject + " name must not contain control or invalid characters");
    }
    if (trimmed.length() > MAX_NAME_LENGTH) {
      throw violation.apply(
          codePrefix + ".too-long",
          subject + " name must have at most " + MAX_NAME_LENGTH + " characters");
    }
    return trimmed;
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
