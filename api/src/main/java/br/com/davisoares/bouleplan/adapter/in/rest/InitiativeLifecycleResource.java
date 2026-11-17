package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ArchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeleteInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestoreInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchiveInitiativeUseCase;
import br.com.davisoares.bouleplan.domain.Initiative;
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

/** REST adapter for the archive and delete transitions of an initiative. */
@Path("/initiatives")
@Tag(name = "Initiatives")
public class InitiativeLifecycleResource {

  private final ArchiveInitiativeUseCase archiveInitiative;
  private final UnarchiveInitiativeUseCase unarchiveInitiative;
  private final DeleteInitiativeUseCase deleteInitiative;
  private final RestoreInitiativeUseCase restoreInitiative;

  /** Wires the inbound ports. */
  public InitiativeLifecycleResource(
      ArchiveInitiativeUseCase archiveInitiative,
      UnarchiveInitiativeUseCase unarchiveInitiative,
      DeleteInitiativeUseCase deleteInitiative,
      RestoreInitiativeUseCase restoreInitiative) {
    this.archiveInitiative = archiveInitiative;
    this.unarchiveInitiative = unarchiveInitiative;
    this.deleteInitiative = deleteInitiative;
    this.restoreInitiative = restoreInitiative;
  }

  /** Archives an active initiative; its color becomes free. */
  @POST
  @Path("/{id}/archive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "archiveInitiative", summary = "Archives an active initiative")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The archived initiative",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = InitiativeResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_ACTIVE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public InitiativeResponse archive(@PathParam("id") UUID id) {
    return respond(archiveInitiative.archive(id));
  }

  /** Brings an archived initiative back, keeping its color. */
  @POST
  @Path("/{id}/unarchive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "unarchiveInitiative",
      summary = "Unarchives an initiative; a no-op if it is already active")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The initiative",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = InitiativeResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No archived or active initiative with this id",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public InitiativeResponse unarchive(@PathParam("id") UUID id) {
    return respond(unarchiveInitiative.unarchive(id));
  }

  /** Soft-deletes an active initiative. */
  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteInitiative", summary = "Deletes an active initiative")
  @APIResponse(responseCode = "204", description = "Initiative deleted")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_ACTIVE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void delete(@PathParam("id") UUID id) {
    respond(deleteInitiative.delete(id));
  }

  /** Restores a deleted initiative. */
  @POST
  @Path("/{id}/restore")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "restoreInitiative",
      summary = "Restores a deleted initiative; a no-op if it is not deleted")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The initiative",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = InitiativeResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No initiative with this id",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public InitiativeResponse restore(@PathParam("id") UUID id) {
    return respond(restoreInitiative.restore(id));
  }

  private static InitiativeResponse respond(Optional<Initiative> initiative) {
    return initiative.map(InitiativeResponse::from).orElseThrow(NotFoundException::new);
  }
}
