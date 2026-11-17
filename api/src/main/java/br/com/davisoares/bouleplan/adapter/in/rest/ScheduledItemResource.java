package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ManageScheduledItemsUseCase;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
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

/** REST adapter to place tasks on days and move them around. */
@Path("/scheduled-items")
@Tag(name = "Planner")
public class ScheduledItemResource {

  private static final String RULES =
      "scheduled-item.time.invalid, or a malformed request (http.400)";
  private static final String CONFLICT =
      "scheduled-item.overlap with another dedicated block, or scheduled-item.duplicate in a"
          + " day list";
  private static final String DONE = "scheduled-item.task-done: the task is done";

  private final ManageScheduledItemsUseCase manageItems;
  private final ObjectMapper objectMapper;

  /** Wires the inbound port. */
  public ScheduledItemResource(ManageScheduledItemsUseCase manageItems, ObjectMapper objectMapper) {
    this.manageItems = manageItems;
    this.objectMapper = objectMapper;
  }

  /** Adds a task to a day list, or creates a dedicated block when both times are sent. */
  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "createScheduledItem",
      summary = "Adds a task to a day list, or creates a dedicated block when both times are sent")
  @RequestBody(
      required = true,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = CreateScheduledItemRequest.class)))
  @APIResponse(
      responseCode = "201",
      description = "Item created",
      headers = @Header(name = "Location", description = "URI of the created item"),
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = ScheduledItemResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = RULES,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_TASK,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.CONFLICT,
      description = CONFLICT,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.UNPROCESSABLE,
      description = DONE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public RestResponse<ScheduledItemResponse> create(String body) {
    ScheduledItem created =
        manageItems
            .create(ScheduledItemParser.create(objectMapper, body))
            .orElseThrow(NotFoundException::new);
    return RestResponse.ResponseBuilder.<ScheduledItemResponse>created(
            URI.create("/scheduled-items/" + created.getId()))
        .entity(ScheduledItemResponse.from(created))
        .build();
  }

  /** Moves, resizes or reorders an item, or turns it into the other kind. */
  @PATCH
  @Path("/{id}")
  @Consumes({"application/merge-patch+json", MediaType.APPLICATION_JSON})
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "updateScheduledItem",
      summary =
          "Moves, resizes or reorders an item; both times null make a day-list entry,"
              + " both set make a block")
  @RequestBody(
      required = true,
      content = {
        @Content(
            mediaType = "application/merge-patch+json",
            schema = @Schema(implementation = UpdateScheduledItemRequest.class)),
        @Content(
            mediaType = MediaType.APPLICATION_JSON,
            schema = @Schema(implementation = UpdateScheduledItemRequest.class))
      })
  @APIResponse(
      responseCode = Responses.OK,
      description = "The updated item",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = ScheduledItemResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = RULES,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_ITEM,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.CONFLICT,
      description = CONFLICT,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.UNPROCESSABLE,
      description = DONE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public ScheduledItemResponse update(@PathParam("id") UUID id, String body) {
    return manageItems
        .update(id, ScheduledItemParser.update(objectMapper, body))
        .map(ScheduledItemResponse::from)
        .orElseThrow(NotFoundException::new);
  }

  /** Deletes an item for good. */
  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteScheduledItem", summary = "Deletes an item")
  @APIResponse(responseCode = "204", description = "The item is gone")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_ITEM,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void delete(@PathParam("id") UUID id) {
    if (!manageItems.delete(id)) {
      throw new NotFoundException();
    }
  }
}
