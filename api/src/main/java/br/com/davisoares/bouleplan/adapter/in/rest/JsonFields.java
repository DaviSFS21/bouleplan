package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

/** Typed readers of JSON body fields; a value of the wrong type is a malformed request. */
@SuppressWarnings("PMD.GodClass") // one small reader per JSON type, with nothing shared
final class JsonFields {

  private static final DateTimeFormatter CLOCK =
      DateTimeFormatter.ofPattern("HH:mm").withResolverStyle(ResolverStyle.STRICT);

  private JsonFields() {}

  /** An ISO date field that is absent, {@code null} or a valid date; anything else is malformed. */
  static Change<LocalDate> date(JsonNode root, String field) {
    Change<String> text = JsonBodies.text(root, field);
    try {
      return text.present()
          ? Change.of(text.value() == null ? null : LocalDate.parse(text.value()))
          : Change.absent();
    } catch (DateTimeParseException e) {
      throw new MalformedRequestException(e);
    }
  }

  /**
   * A {@code HH:mm} field that is absent, {@code null} or a valid time; anything else is malformed.
   */
  static Change<LocalTime> time(JsonNode root, String field) {
    Change<String> text = JsonBodies.text(root, field);
    try {
      return text.present()
          ? Change.of(text.value() == null ? null : LocalTime.parse(text.value(), CLOCK))
          : Change.absent();
    } catch (DateTimeParseException e) {
      throw new MalformedRequestException(e);
    }
  }

  /**
   * An integer field that is absent, {@code null} or a JSON integer; anything else is malformed.
   */
  static Change<Integer> integer(JsonNode root, String field) {
    JsonNode node = root.get(field);
    if (node != null && !node.isNull() && !(node.isIntegralNumber() && node.canConvertToInt())) {
      throw new MalformedRequestException();
    }
    return node == null ? Change.absent() : Change.of(node.isNull() ? null : node.intValue());
  }

  /** A JSON number field that is absent, {@code null} or numeric; anything else is malformed. */
  static Change<BigDecimal> number(JsonNode root, String field) {
    JsonNode node = root.get(field);
    if (node != null && !node.isNull() && !node.isNumber()) {
      throw new MalformedRequestException();
    }
    return node == null ? Change.absent() : Change.of(node.isNull() ? null : node.decimalValue());
  }

  /** A boolean field that is absent, {@code null} or a JSON boolean; anything else is malformed. */
  static Change<Boolean> bool(JsonNode root, String field) {
    JsonNode node = root.get(field);
    if (node != null && !node.isNull() && !node.isBoolean()) {
      throw new MalformedRequestException();
    }
    return node == null ? Change.absent() : Change.of(node.isNull() ? null : node.booleanValue());
  }

  /** A UUID field that is absent, {@code null} or a UUID string; anything else is malformed. */
  static Change<UUID> uuid(JsonNode root, String field) {
    Change<String> text = JsonBodies.text(root, field);
    try {
      return text.present()
          ? Change.of(text.value() == null ? null : UUID.fromString(text.value()))
          : Change.absent();
    } catch (IllegalArgumentException e) {
      throw new MalformedRequestException(e);
    }
  }

  /** A token field resolved by {@code lookup}; an unknown token is malformed. */
  static <T> Change<T> token(JsonNode root, String field, Function<String, Optional<T>> lookup) {
    Change<String> text = JsonBodies.text(root, field);
    return text.present() && text.value() != null
        ? Change.of(lookup.apply(text.value()).orElseThrow(MalformedRequestException::new))
        : text.present() ? Change.of(null) : Change.absent();
  }

  /** The value of a field that cannot be {@code null}: a present {@code null} is malformed. */
  static <T> Change<T> required(Change<T> change) {
    if (change.present() && change.value() == null) {
      throw new MalformedRequestException();
    }
    return change;
  }

  /** The value of a field that must be sent and cannot be {@code null}. */
  static <T> T mandatory(Change<T> change) {
    if (!change.present() || change.value() == null) {
      throw new MalformedRequestException();
    }
    return change.value();
  }
}
