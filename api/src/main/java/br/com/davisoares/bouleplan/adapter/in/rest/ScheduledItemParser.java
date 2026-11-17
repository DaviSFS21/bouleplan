package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.in.UpdateScheduledItemCommand;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;

/** Reads the JSON bodies of scheduled items; the domain validates what is missing. */
final class ScheduledItemParser {

  private static final String DATE = "date";
  private static final String START_TIME = "startTime";
  private static final String END_TIME = "endTime";

  private static final Set<String> CREATE_FIELDS = Set.of("taskId", DATE, START_TIME, END_TIME);
  private static final Set<String> UPDATE_FIELDS = Set.of(DATE, START_TIME, END_TIME, "sortOrder");

  private ScheduledItemParser() {}

  static CreateScheduledItemCommand create(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, CREATE_FIELDS);
    return new CreateScheduledItemCommand(
        JsonFields.mandatory(JsonFields.uuid(root, "taskId")),
        JsonFields.mandatory(JsonFields.date(root, DATE)),
        JsonFields.time(root, START_TIME).value(),
        JsonFields.time(root, END_TIME).value());
  }

  static UpdateScheduledItemCommand update(ObjectMapper mapper, String body) {
    JsonNode root = JsonBodies.readObject(mapper, body, UPDATE_FIELDS);
    return new UpdateScheduledItemCommand(
        JsonFields.required(JsonFields.date(root, DATE)),
        JsonFields.time(root, START_TIME),
        JsonFields.time(root, END_TIME),
        JsonFields.integer(root, "sortOrder"));
  }
}
