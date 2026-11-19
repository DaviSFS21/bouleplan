package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreateTaskUseCase;
import br.com.davisoares.bouleplan.domain.Task;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.NotFoundException;
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

/** REST adapter to add a task to an initiative. */
@Path("/initiatives/{id}/tasks")
@Tag(name = "Tasks")
public class InitiativeTasksResource {

  private final CreateTaskUseCase createTask;
  private final TaskResponses responses;
  private final ObjectMapper objectMapper;

  /** Wires the inbound ports. */
  public InitiativeTasksResource(
      CreateTaskUseCase createTask, TaskResponses responses, ObjectMapper objectMapper) {
    this.createTask = createTask;
    this.responses = responses;
    this.objectMapper = objectMapper;
  }

  /** Adds a task to an active initiative. */
  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "createTask",
      summary =
          "Creates a task in an active initiative; without epicId it goes to the implicit epic")
  @RequestBody(
      required = true,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = CreateTaskRequest.class)))
  @APIResponse(
      responseCode = "201",
      description = "Task created",
      headers = @Header(name = "Location", description = "URI of the created task"),
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
      description =
          "No active initiative with this id, or epicId is not an active named epic of it",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public RestResponse<TaskResponse> create(@PathParam("id") UUID initiativeId, String body) {
    Task created =
        createTask
            .create(initiativeId, CreateTaskParser.parse(objectMapper, body))
            .orElseThrow(NotFoundException::new);
    return RestResponse.ResponseBuilder.<TaskResponse>created(
            URI.create("/tasks/" + created.getId()))
        .entity(responses.of(created))
        .build();
  }
}
