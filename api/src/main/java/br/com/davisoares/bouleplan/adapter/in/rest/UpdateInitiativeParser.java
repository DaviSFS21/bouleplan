package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Iterator;
import java.util.Set;

/** Reads a JSON merge-patch body, keeping absent fields apart from {@code null} ones. */
final class UpdateInitiativeParser {

  private static final Set<String> FIELDS =
      Set.of("name", "description", "overallDeadline", "color");

  private UpdateInitiativeParser() {}

  static UpdateInitiativeCommand parse(ObjectMapper mapper, String body) {
    JsonNode root = readObject(mapper, body, FIELDS);
    return new UpdateInitiativeCommand(
        text(root, "name"),
        text(root, "description"),
        date(root, "overallDeadline"),
        text(root, "color"));
  }

  /** Parses a JSON object body whose field names must all be in {@code fields}. */
  static JsonNode readObject(ObjectMapper mapper, String body, Set<String> fields) {
    JsonNode root = readTree(mapper, body);
    if (!root.isObject()) {
      throw new MalformedRequestException();
    }
    for (Iterator<String> names = root.fieldNames(); names.hasNext(); ) {
      if (!fields.contains(names.next())) {
        throw new MalformedRequestException();
      }
    }
    return root;
  }

  private static JsonNode readTree(ObjectMapper mapper, String body) {
    try {
      return mapper
          .reader()
          .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
          .readTree(body == null ? "" : body);
    } catch (JsonProcessingException e) {
      throw new MalformedRequestException(e);
    }
  }

  static Change<String> text(JsonNode root, String field) {
    JsonNode node = root.get(field);
    if (node != null && !node.isNull() && !node.isTextual()) {
      throw new MalformedRequestException();
    }
    return node == null ? Change.absent() : Change.of(node.textValue());
  }

  private static Change<LocalDate> date(JsonNode root, String field) {
    Change<String> text = text(root, field);
    try {
      return text.present()
          ? Change.of(text.value() == null ? null : LocalDate.parse(text.value()))
          : Change.absent();
    } catch (DateTimeParseException e) {
      throw new MalformedRequestException(e);
    }
  }
}
