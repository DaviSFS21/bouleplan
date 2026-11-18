package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdateEpicCommand;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;

/** Reads a JSON merge-patch body of an epic. */
final class UpdateEpicParser {

  private static final Set<String> FIELDS = Set.of("name");

  private UpdateEpicParser() {}

  static UpdateEpicCommand parse(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, FIELDS);
    return new UpdateEpicCommand(JsonBodies.text(root, "name"));
  }
}
