package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreateCalendarEventCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateCalendarEventCommand;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;

/** Reads the JSON bodies of calendar events; the domain validates what is missing. */
final class CalendarEventParser {

  private static final Set<String> FIELDS = Set.of("title", "date", "startTime", "endTime");

  private CalendarEventParser() {}

  static CreateCalendarEventCommand create(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, FIELDS);
    return new CreateCalendarEventCommand(
        JsonBodies.text(root, "title").value(),
        JsonFields.date(root, "date").value(),
        JsonFields.time(root, "startTime").value(),
        JsonFields.time(root, "endTime").value());
  }

  static UpdateCalendarEventCommand update(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, FIELDS);
    return new UpdateCalendarEventCommand(
        JsonFields.required(JsonBodies.text(root, "title")),
        JsonFields.required(JsonFields.date(root, "date")),
        JsonFields.required(JsonFields.time(root, "startTime")),
        JsonFields.required(JsonFields.time(root, "endTime")));
  }
}
