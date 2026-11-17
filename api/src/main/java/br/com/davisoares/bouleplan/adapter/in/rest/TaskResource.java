package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.GetTaskUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListTasksUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateTaskUseCase;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter to list, read and edit tasks. */
@Path("/tasks")
@Tag(name = "Tasks")
public class TaskResource {

  private final ListTasksUseCase listTasks;
  private final GetTaskUseCase getTask;
  private final UpdateTaskUseCase updateTask;
  private final ObjectMapper objectMapper;

  /** Wires the inbound ports. */
  public TaskResource(
      ListTasksUseCase listTasks,
      GetTaskUseCase getTask,
      UpdateTaskUseCase updateTask,
      ObjectMapper objectMapper) {
    this.listTasks = listTasks;
    this.getTask = getTask;
    this.updateTask = updateTask;
    this.objectMapper = objectMapper;
  }

  /** Lists the tasks the board shows. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listTasks",
      summary =
          "Lists the active tasks whose phase and initiative are active,"
              + " by priority, deadline and creation")
  @APIResponse(
      responseCode = Responses.OK,
      description = "Visible tasks",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = TaskResponse[].class)))
  public List<TaskResponse> list() {
    return listTasks.listActive().stream().map(TaskResponse::from).toList();
  }

  /** Returns one active task. */
  @GET
  @Path("/{id}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "getTask", summary = "Gets an active task by id")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The task",
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
  public TaskResponse get(@PathParam("id") UUID id) {
    return getTask.find(id).map(TaskResponse::from).orElseThrow(NotFoundException::new);
  }

  /** Partially updates an active task (JSON merge patch semantics). */
  @PATCH
  @Path("/{id}")
  @Consumes({"application/merge-patch+json", MediaType.APPLICATION_JSON})
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "updateTask",
      summary = "Updates an active task; absent fields stay, null clears where allowed")
  @RequestBody(
      required = true,
      content = {
        @Content(
            mediaType = "application/merge-patch+json",
            schema = @Schema(implementation = UpdateTaskRequest.class)),
        @Content(
            mediaType = MediaType.APPLICATION_JSON,
            schema = @Schema(implementation = UpdateTaskRequest.class))
      })
  @APIResponse(
      responseCode = Responses.OK,
      description = "The updated task",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = TaskResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "Rule violation or malformed request",
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
  public TaskResponse update(@PathParam("id") UUID id, String body) {
    return updateTask
        .update(id, UpdateTaskParser.parse(objectMapper, body))
        .map(TaskResponse::from)
        .orElseThrow(NotFoundException::new);
  }
}
