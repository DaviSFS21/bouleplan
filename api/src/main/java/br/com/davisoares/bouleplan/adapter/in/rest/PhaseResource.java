package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.GetPhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdatePhaseUseCase;
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

/** REST adapter to read and rename a phase. */
@Path("/phases")
@Tag(name = "Phases")
public class PhaseResource {

  private final GetPhaseUseCase getPhase;
  private final UpdatePhaseUseCase updatePhase;
  private final ObjectMapper objectMapper;

  /** Wires the inbound ports. */
  public PhaseResource(
      GetPhaseUseCase getPhase, UpdatePhaseUseCase updatePhase, ObjectMapper objectMapper) {
    this.getPhase = getPhase;
    this.updatePhase = updatePhase;
    this.objectMapper = objectMapper;
  }

  /** Returns one active phase. */
  @GET
  @Path("/{id}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "getPhase", summary = "Gets an active phase by id")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The phase",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = PhaseResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_PHASE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public PhaseResponse get(@PathParam("id") UUID id) {
    return getPhase.find(id).map(PhaseResponse::from).orElseThrow(NotFoundException::new);
  }

  /** Partially updates an active phase (JSON merge patch semantics). */
  @PATCH
  @Path("/{id}")
  @Consumes({"application/merge-patch+json", MediaType.APPLICATION_JSON})
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "updatePhase", summary = "Updates an active phase; absent fields stay")
  @RequestBody(
      required = true,
      content = {
        @Content(
            mediaType = "application/merge-patch+json",
            schema = @Schema(implementation = UpdatePhaseRequest.class)),
        @Content(
            mediaType = MediaType.APPLICATION_JSON,
            schema = @Schema(implementation = UpdatePhaseRequest.class))
      })
  @APIResponse(
      responseCode = Responses.OK,
      description = "The updated phase",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = PhaseResponse.class)))
  @APIResponse(
      responseCode = Responses.BAD_REQUEST,
      description = "Rule violation or malformed request",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_PHASE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public PhaseResponse update(@PathParam("id") UUID id, String body) {
    return updatePhase
        .update(id, UpdatePhaseParser.parse(objectMapper, body))
        .map(PhaseResponse::from)
        .orElseThrow(NotFoundException::new);
  }
}
