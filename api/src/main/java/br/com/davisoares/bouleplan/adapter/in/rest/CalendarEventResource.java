package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ManageCalendarEventsUseCase;
import br.com.davisoares.bouleplan.domain.CalendarEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.net.URI;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.headers.Header;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestResponse;

/** REST adapter to create, edit and delete fixed calendar events. */
@Path("/calendar-events")
@Tag(name = "Planner")
public class CalendarEventResource {

  private final ManageCalendarEventsUseCase manageEvents;
  private final ObjectMapper objectMapper;

  /** Wires the inbound port. */
  public CalendarEventResource(
      ManageCalendarEventsUseCase manageEvents, ObjectMapper objectMapper) {
    this.manageEvents = manageEvents;
    this.objectMapper = objectMapper;
  }

  /** Creates a fixed event. */
  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "createCalendarEvent", summary = "Creates a fixed event")
  @RequestBody(
      required = true,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = CreateCalendarEventRequest.class)))
  @APIResponse(
      responseCode = "201",
      description = "Event created",
      headers = @Header(name = "Location", description = "URI of the created event"),
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = CalendarEventResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "Rule violation or malformed request",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public RestResponse<CalendarEventResponse> create(String body) {
    CalendarEvent created = manageEvents.create(CalendarEventParser.create(objectMapper, body));
    return RestResponse.ResponseBuilder.<CalendarEventResponse>created(
            URI.create("/calendar-events/" + created.getId()))
        .entity(CalendarEventResponse.from(created))
        .build();
  }

  /** Partially updates an event (JSON merge patch semantics). */
  @PATCH
  @Path("/{id}")
  @Consumes({"application/merge-patch+json", MediaType.APPLICATION_JSON})
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "updateCalendarEvent",
      summary = "Updates an event; absent fields stay and none can be null")
  @RequestBody(
      required = true,
      content = {
        @Content(
            mediaType = "application/merge-patch+json",
            schema = @Schema(implementation = UpdateCalendarEventRequest.class)),
        @Content(
            mediaType = MediaType.APPLICATION_JSON,
            schema = @Schema(implementation = UpdateCalendarEventRequest.class))
      })
  @APIResponse(
      responseCode = Responses.OK,
      description = "The updated event",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = CalendarEventResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "Rule violation or malformed request",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_EVENT,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public CalendarEventResponse update(@PathParam("id") UUID id, String body) {
    return manageEvents
        .update(id, CalendarEventParser.update(objectMapper, body))
        .map(CalendarEventResponse::from)
        .orElseThrow(NotFoundException::new);
  }

  /** Deletes an event for good. */
  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteCalendarEvent", summary = "Deletes an event")
  @APIResponse(responseCode = "204", description = "The event is gone")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_EVENT,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void delete(@PathParam("id") UUID id) {
    if (!manageEvents.delete(id)) {
      throw new NotFoundException();
    }
  }
}
