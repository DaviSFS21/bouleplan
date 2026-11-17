package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.GetPlannerUseCase;
import br.com.davisoares.bouleplan.domain.PlannerWeek;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.enums.ParameterIn;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter to read one week of the planner. */
@Path("/planner")
@Tag(name = "Planner")
public class PlannerResource {

  private final GetPlannerUseCase getPlanner;

  /** Wires the inbound port. */
  public PlannerResource(GetPlannerUseCase getPlanner) {
    this.getPlanner = getPlanner;
  }

  /** The events and items of the seven days from a Monday. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "getPlanner",
      summary = "Gets the fixed events and the items of visible tasks of one week")
  @Parameter(
      name = "weekStart",
      in = ParameterIn.QUERY,
      required = true,
      description = "The Monday that starts the week",
      schema = @Schema(implementation = String.class, format = "date"))
  @APIResponse(
      responseCode = Responses.OK,
      description = "The week",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = PlannerResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "planner.week.invalid when weekStart is missing, not a date or not a Monday",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public PlannerResponse get(@QueryParam("weekStart") String weekStart) {
    return PlannerResponse.from(getPlanner.week(parse(weekStart)));
  }

  private static LocalDate parse(String weekStart) {
    LocalDate parsed;
    try {
      parsed = weekStart == null ? PlannerWeek.requireMonday(null) : LocalDate.parse(weekStart);
    } catch (DateTimeParseException e) {
      parsed = PlannerWeek.requireMonday(null);
    }
    return parsed;
  }
}
