package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ManageIntrospectionUseCase;
import br.com.davisoares.bouleplan.domain.Introspection;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.Parameter;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter for the weekly review sheet. */
@Path("/introspections/{weekStart}")
@Tag(name = "Introspecto")
public class IntrospectionResource {

  private static final String WEEK = "The Monday of the reviewed week";
  private static final String SHEET = "The sheet";
  private static final String INVALID =
      "introspection.week.invalid, an answer rule code, or a malformed request";
  private static final String CLOSED = "introspection.closed: the sheet is already closed";

  private final ManageIntrospectionUseCase introspections;
  private final ObjectMapper objectMapper;

  /** Wires the inbound port. */
  public IntrospectionResource(
      ManageIntrospectionUseCase introspections, ObjectMapper objectMapper) {
    this.introspections = introspections;
    this.objectMapper = objectMapper;
  }

  /** The stored sheet of a week, or an empty draft when none exists. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "getIntrospection",
      summary = "Gets the sheet of a week, or an unsaved empty draft")
  @APIResponse(
      responseCode = Responses.OK,
      description = SHEET,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = IntrospectionResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "introspection.week.invalid",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public IntrospectionResponse get(
      @PathParam("weekStart")
          @Parameter(
              description = WEEK,
              schema = @Schema(implementation = String.class, format = "date"))
          String weekStart) {
    return IntrospectionResponse.from(introspections.get(parse(weekStart)));
  }

  /** Saves answers into the draft of a week, creating it when needed. */
  @PUT
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "saveIntrospection", summary = "Saves the answers of an open sheet")
  @RequestBody(
      required = true,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = SaveIntrospectionRequest.class)))
  @APIResponse(
      responseCode = Responses.OK,
      description = SHEET,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = IntrospectionResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = INVALID,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.CONFLICT,
      description = CLOSED,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public IntrospectionResponse save(
      @PathParam("weekStart")
          @Parameter(
              description = WEEK,
              schema = @Schema(implementation = String.class, format = "date"))
          String weekStart,
      String body) {
    LocalDate week = parse(weekStart);
    return IntrospectionResponse.from(
        introspections.save(week, IntrospectionParser.save(objectMapper, body)));
  }

  /** Closes the sheet of a week for good. */
  @POST
  @Path("/close")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "closeIntrospection",
      summary = "Closes the sheet of a week, creating an empty one if needed")
  @APIResponse(
      responseCode = Responses.OK,
      description = SHEET,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = IntrospectionResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "introspection.week.invalid",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.UNPROCESSABLE,
      description = "introspection.week.future: the week has not started",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.CONFLICT,
      description = CLOSED,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public IntrospectionResponse close(
      @PathParam("weekStart")
          @Parameter(
              description = WEEK,
              schema = @Schema(implementation = String.class, format = "date"))
          String weekStart) {
    return IntrospectionResponse.from(introspections.close(parse(weekStart)));
  }

  private static LocalDate parse(String weekStart) {
    LocalDate parsed;
    try {
      parsed = LocalDate.parse(weekStart);
    } catch (DateTimeParseException e) {
      parsed = Introspection.requireWeek(null);
    }
    return parsed;
  }
}
