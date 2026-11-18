package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.GetEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateEpicUseCase;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;

/** REST adapter to read and rename an epic. */
@Path("/epics")
@Tag(name = "Epics")
public class EpicResource {

  private final GetEpicUseCase getEpic;
  private final UpdateEpicUseCase updateEpic;
  private final ObjectMapper objectMapper;

  /** Wires the inbound ports. */
  public EpicResource(
      GetEpicUseCase getEpic, UpdateEpicUseCase updateEpic, ObjectMapper objectMapper) {
    this.getEpic = getEpic;
    this.updateEpic = updateEpic;
    this.objectMapper = objectMapper;
  }

  /** Returns one active epic. */
  @GET
  @Path("/{id}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "getEpic", summary = "Gets an active epic by id")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The epic",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = EpicResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_EPIC,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public EpicResponse get(@PathParam("id") UUID id) {
    return getEpic.find(id).map(EpicResponse::from).orElseThrow(NotFoundException::new);
  }

  /** Partially updates an active epic (JSON merge patch semantics). */
  @PATCH
  @Path("/{id}")
  @Consumes({"application/merge-patch+json", MediaType.APPLICATION_JSON})
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "updateEpic", summary = "Updates an active epic; absent fields stay")
  @RequestBody(
      required = true,
      content = {
        @Content(
            mediaType = "application/merge-patch+json",
            schema = @Schema(implementation = UpdateEpicRequest.class)),
        @Content(
            mediaType = MediaType.APPLICATION_JSON,
            schema = @Schema(implementation = UpdateEpicRequest.class))
      })
  @APIResponse(
      responseCode = Responses.OK,
      description = "The updated epic",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = EpicResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "Rule violation or malformed request",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_EPIC,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public EpicResponse update(@PathParam("id") UUID id, String body) {
    return updateEpic
        .update(id, UpdateEpicParser.parse(objectMapper, body))
        .map(EpicResponse::from)
        .orElseThrow(NotFoundException::new);
  }
}
