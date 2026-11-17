package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Iterator;
import java.util.Set;

/** Strict reading of JSON bodies: unknown fields and mistyped values are malformed requests. */
final class JsonBodies {

  private static final Set<String> NAME_ONLY = Set.of("name");

  private JsonBodies() {}

  /** The {@code name} of a create body; a missing or null name stays {@code null}. */
  static String createName(ObjectMapper mapper, String body) {
    return text(readObject(mapper, body, NAME_ONLY), "name").value();
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

  /** A string field that is absent, {@code null} or text; anything else is malformed. */
  static Change<String> text(JsonNode root, String field) {
    JsonNode node = root.get(field);
    if (node != null && !node.isNull() && !node.isTextual()) {
      throw new MalformedRequestException();
    }
    return node == null ? Change.absent() : Change.of(node.textValue());
  }

  private static JsonNode readTree(ObjectMapper mapper, String body) {
    try {
      return mapper
          .reader()
          .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
          .with(DeserializationFeature.FAIL_ON_READING_DUP_TREE_KEY)
          .with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
          .readTree(body == null ? "" : body);
    } catch (JsonProcessingException e) {
      throw new MalformedRequestException(e);
    }
  }
}
