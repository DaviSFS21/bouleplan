package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ArchiveTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeleteTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestoreTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchiveTaskUseCase;
import br.com.davisoares.bouleplan.domain.Task;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.Optional;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter for the archive and delete transitions of a task. */
@Path("/tasks")
@Tag(name = "Tasks")
public class TaskLifecycleResource {

  private final ArchiveTaskUseCase archiveTask;
  private final UnarchiveTaskUseCase unarchiveTask;
  private final DeleteTaskUseCase deleteTask;
  private final RestoreTaskUseCase restoreTask;

  /** Wires the inbound ports. */
  public TaskLifecycleResource(
      ArchiveTaskUseCase archiveTask,
      UnarchiveTaskUseCase unarchiveTask,
      DeleteTaskUseCase deleteTask,
      RestoreTaskUseCase restoreTask) {
    this.archiveTask = archiveTask;
    this.unarchiveTask = unarchiveTask;
    this.deleteTask = deleteTask;
    this.restoreTask = restoreTask;
  }

  /** Archives an active task. */
  @POST
  @Path("/{id}/archive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "archiveTask", summary = "Archives an active task")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The archived task",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = TaskResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_TASK,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public TaskResponse archive(@PathParam("id") UUID id) {
    return respond(archiveTask.archive(id));
  }

  /** Brings an archived task back. */
  @POST
  @Path("/{id}/unarchive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "unarchiveTask",
      summary = "Unarchives a task; a no-op if it is already active")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The task",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = TaskResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description =
          "No archived or active task with this id in an active phase and initiative of the user",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public TaskResponse unarchive(@PathParam("id") UUID id) {
    return respond(unarchiveTask.unarchive(id));
  }

  /** Soft-deletes an active task. */
  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteTask", summary = "Deletes an active task")
  @APIResponse(responseCode = "204", description = "Task deleted")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_TASK,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void delete(@PathParam("id") UUID id) {
    respond(deleteTask.delete(id));
  }

  /** Restores a deleted task. */
  @POST
  @Path("/{id}/restore")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "restoreTask",
      summary = "Restores a deleted task; a no-op if it is not deleted")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The task",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = TaskResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No task with this id in an active phase and initiative of the user",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public TaskResponse restore(@PathParam("id") UUID id) {
    return respond(restoreTask.restore(id));
  }

  private static TaskResponse respond(Optional<Task> task) {
    return task.map(TaskResponse::from).orElseThrow(NotFoundException::new);
  }
}
