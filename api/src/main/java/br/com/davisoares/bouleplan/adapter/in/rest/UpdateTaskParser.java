package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdateTaskCommand;
import br.com.davisoares.bouleplan.domain.TaskPriority;
import br.com.davisoares.bouleplan.domain.TaskStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;

/** Reads a JSON merge-patch body of a task, keeping absent fields apart from {@code null} ones. */
final class UpdateTaskParser {

  private static final Set<String> FIELDS =
      Set.of(
          "title", "description", "deadline", "estimatedEffort", "priority", "status", "isBlocked");

  private UpdateTaskParser() {}

  static UpdateTaskCommand parse(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, FIELDS);
    return new UpdateTaskCommand(
        JsonFields.required(JsonBodies.text(root, "title")),
        JsonBodies.text(root, "description"),
        JsonFields.date(root, "deadline"),
        JsonFields.number(root, "estimatedEffort"),
        JsonFields.required(JsonFields.token(root, "priority", TaskPriority::findByToken)),
        JsonFields.required(JsonFields.token(root, "status", TaskStatus::findByToken)),
        JsonFields.required(JsonFields.bool(root, "isBlocked")));
  }
}
