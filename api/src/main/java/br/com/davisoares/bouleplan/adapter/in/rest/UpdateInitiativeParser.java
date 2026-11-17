package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Set;

/** Reads a JSON merge-patch body, keeping absent fields apart from {@code null} ones. */
final class UpdateInitiativeParser {

  private static final Set<String> FIELDS =
      Set.of("name", "description", "overallDeadline", "color");

  private UpdateInitiativeParser() {}

  static UpdateInitiativeCommand parse(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, FIELDS);
    return new UpdateInitiativeCommand(
        JsonBodies.text(root, "name"),
        JsonBodies.text(root, "description"),
        date(root, "overallDeadline"),
        JsonBodies.text(root, "color"));
  }

  private static Change<LocalDate> date(JsonNode root, String field) {
    Change<String> text = JsonBodies.text(root, field);
    try {
      return text.present()
          ? Change.of(text.value() == null ? null : LocalDate.parse(text.value()))
          : Change.absent();
    } catch (DateTimeParseException e) {
      throw new MalformedRequestException(e);
    }
  }
}
