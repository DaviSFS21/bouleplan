package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ListTaskScheduledItemsUseCase;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter to read the dedicated blocks of a task. */
@Path("/tasks/{id}/scheduled-items")
@Tag(name = "Planner")
public class TaskScheduledItemsResource {

  private final ListTaskScheduledItemsUseCase listItems;

  /** Wires the inbound port. */
  public TaskScheduledItemsResource(ListTaskScheduledItemsUseCase listItems) {
    this.listItems = listItems;
  }

  /** The dedicated blocks of a visible task on any date. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listTaskScheduledItems",
      summary = "Lists the dedicated blocks of a task by date and start")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The blocks",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = ScheduledItemResponse[].class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_TASK,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public List<ScheduledItemResponse> list(@PathParam("id") UUID id) {
    return listItems.findBlocksOf(id).orElseThrow(NotFoundException::new).stream()
        .map(ScheduledItemResponse::from)
        .toList();
  }
}
