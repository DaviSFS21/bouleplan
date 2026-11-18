package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.AddTaskBlockerUseCase;
import br.com.davisoares.bouleplan.application.port.in.RemoveTaskBlockerUseCase;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter for the blocker links between two tasks. */
@Path("/tasks/{blockingId}/blocks/{blockedId}")
@Tag(name = "Tasks")
public class TaskBlockersResource {

  private static final String NO_TASKS =
      "Either task is not an active task in an active epic and initiative of the user";

  private final AddTaskBlockerUseCase addBlocker;
  private final RemoveTaskBlockerUseCase removeBlocker;

  /** Wires the inbound ports. */
  public TaskBlockersResource(
      AddTaskBlockerUseCase addBlocker, RemoveTaskBlockerUseCase removeBlocker) {
    this.addBlocker = addBlocker;
    this.removeBlocker = removeBlocker;
  }

  /** Makes the first task block the second; a no-op if it already does. */
  @PUT
  @Operation(
      operationId = "addTaskBlocker",
      summary = "Makes a task block another; a no-op if the link exists")
  @APIResponse(responseCode = "204", description = "The link exists")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = NO_TASKS,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = "422",
      description =
          "task.blocker.self for the same task twice, task.blocker.cycle if the blocked task"
              + " already blocks the blocking one, directly or through other tasks, hidden or not",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void add(
      @PathParam("blockingId") UUID blockingId, @PathParam("blockedId") UUID blockedId) {
    if (!addBlocker.add(blockingId, blockedId)) {
      throw new NotFoundException();
    }
  }

  /** Ends the blocking; a no-op if there was none. */
  @DELETE
  @Operation(
      operationId = "removeTaskBlocker",
      summary = "Ends the blocking of a task by another; a no-op if there is no link")
  @APIResponse(responseCode = "204", description = "The link does not exist")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = NO_TASKS,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void remove(
      @PathParam("blockingId") UUID blockingId, @PathParam("blockedId") UUID blockedId) {
    if (!removeBlocker.remove(blockingId, blockedId)) {
      throw new NotFoundException();
    }
  }
}
