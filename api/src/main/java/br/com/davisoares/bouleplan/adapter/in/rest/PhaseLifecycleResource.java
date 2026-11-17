package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ArchivePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeletePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestorePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchivePhaseUseCase;
import br.com.davisoares.bouleplan.domain.Phase;
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

/** REST adapter for the archive and delete transitions of a phase. */
@Path("/phases")
@Tag(name = "Phases")
public class PhaseLifecycleResource {

  private final ArchivePhaseUseCase archivePhase;
  private final UnarchivePhaseUseCase unarchivePhase;
  private final DeletePhaseUseCase deletePhase;
  private final RestorePhaseUseCase restorePhase;

  /** Wires the inbound ports. */
  public PhaseLifecycleResource(
      ArchivePhaseUseCase archivePhase,
      UnarchivePhaseUseCase unarchivePhase,
      DeletePhaseUseCase deletePhase,
      RestorePhaseUseCase restorePhase) {
    this.archivePhase = archivePhase;
    this.unarchivePhase = unarchivePhase;
    this.deletePhase = deletePhase;
    this.restorePhase = restorePhase;
  }

  /** Archives an active phase. */
  @POST
  @Path("/{id}/archive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "archivePhase", summary = "Archives an active phase")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The archived phase",
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
  public PhaseResponse archive(@PathParam("id") UUID id) {
    return respond(archivePhase.archive(id));
  }

  /** Brings an archived phase back. */
  @POST
  @Path("/{id}/unarchive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "unarchivePhase",
      summary = "Unarchives a phase; a no-op if it is already active")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The phase",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = PhaseResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No archived or active phase with this id in an active initiative of the user",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public PhaseResponse unarchive(@PathParam("id") UUID id) {
    return respond(unarchivePhase.unarchive(id));
  }

  /** Soft-deletes an active phase. */
  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deletePhase", summary = "Deletes an active phase")
  @APIResponse(responseCode = "204", description = "Phase deleted")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_PHASE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void delete(@PathParam("id") UUID id) {
    respond(deletePhase.delete(id));
  }

  /** Restores a deleted phase. */
  @POST
  @Path("/{id}/restore")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "restorePhase",
      summary = "Restores a deleted phase; a no-op if it is not deleted")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The phase",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = PhaseResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No phase with this id in an active initiative of the user",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public PhaseResponse restore(@PathParam("id") UUID id) {
    return respond(restorePhase.restore(id));
  }

  private static PhaseResponse respond(Optional<Phase> phase) {
    return phase.map(PhaseResponse::from).orElseThrow(NotFoundException::new);
  }
}
