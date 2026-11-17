package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdatePhaseCommand;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;

/** Reads a JSON merge-patch body of a phase. */
final class UpdatePhaseParser {

  private static final Set<String> FIELDS = Set.of("name");

  private UpdatePhaseParser() {}

  static UpdatePhaseCommand parse(ObjectMapper mapper, String body) {
    JsonNode root = UpdateInitiativeParser.readObject(mapper, body, FIELDS);
    return new UpdatePhaseCommand(UpdateInitiativeParser.text(root, "name"));
  }
}
