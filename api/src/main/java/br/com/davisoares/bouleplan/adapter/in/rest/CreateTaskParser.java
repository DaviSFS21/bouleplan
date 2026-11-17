package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreateTaskCommand;
import br.com.davisoares.bouleplan.domain.TaskStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;

/** Reads the body of a task create: a null {@code phaseId} is the implicit phase. */
final class CreateTaskParser {

  private static final Set<String> FIELDS = Set.of("title", "phaseId", "status");

  private CreateTaskParser() {}

  static CreateTaskCommand parse(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, FIELDS);
    return new CreateTaskCommand(
        JsonBodies.text(root, "title").value(),
        JsonFields.uuid(root, "phaseId").value(),
        JsonFields.required(JsonFields.token(root, "status", TaskStatus::findByToken)).value());
  }
}
