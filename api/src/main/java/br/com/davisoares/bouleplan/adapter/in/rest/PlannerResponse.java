package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.Planner;
import java.time.LocalDate;
import java.util.List;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** JSON representation of one week of the planner. */
@Schema(
    name = "Planner",
    requiredProperties = {"weekStart", "events", "items"})
public record PlannerResponse(
    @Schema(implementation = String.class, format = "date") LocalDate weekStart,
    @Schema(description = "Fixed events of the seven days, by date and start")
        List<CalendarEventResponse> events,
    @Schema(description = "Items of visible tasks: by date, day-list order, then start")
        List<ScheduledItemResponse> items) {

  /** Maps the week at the REST boundary. */
  public static PlannerResponse from(Planner planner) {
    return new PlannerResponse(
        planner.weekStart(),
        planner.events().stream().map(CalendarEventResponse::from).toList(),
        planner.items().stream().map(ScheduledItemResponse::from).toList());
  }
}
