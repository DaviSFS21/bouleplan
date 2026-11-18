package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.ArchiveEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.DeleteEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.RestoreEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.UnarchiveEpicUseCase;
import br.com.davisoares.bouleplan.domain.Epic;
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

/** REST adapter for the archive and delete transitions of an epic. */
@Path("/epics")
@Tag(name = "Epics")
public class EpicLifecycleResource {

  private final ArchiveEpicUseCase archiveEpic;
  private final UnarchiveEpicUseCase unarchiveEpic;
  private final DeleteEpicUseCase deleteEpic;
  private final RestoreEpicUseCase restoreEpic;

  /** Wires the inbound ports. */
  public EpicLifecycleResource(
      ArchiveEpicUseCase archiveEpic,
      UnarchiveEpicUseCase unarchiveEpic,
      DeleteEpicUseCase deleteEpic,
      RestoreEpicUseCase restoreEpic) {
    this.archiveEpic = archiveEpic;
    this.unarchiveEpic = unarchiveEpic;
    this.deleteEpic = deleteEpic;
    this.restoreEpic = restoreEpic;
  }

  /** Archives an active epic. */
  @POST
  @Path("/{id}/archive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "archiveEpic", summary = "Archives an active epic")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The archived epic",
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
  public EpicResponse archive(@PathParam("id") UUID id) {
    return respond(archiveEpic.archive(id));
  }

  /** Brings an archived epic back. */
  @POST
  @Path("/{id}/unarchive")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "unarchiveEpic",
      summary = "Unarchives an epic; a no-op if it is already active")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The epic",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = EpicResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No archived or active epic with this id in an active initiative of the user",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public EpicResponse unarchive(@PathParam("id") UUID id) {
    return respond(unarchiveEpic.unarchive(id));
  }

  /** Soft-deletes an active epic. */
  @DELETE
  @Path("/{id}")
  @Operation(operationId = "deleteEpic", summary = "Deletes an active epic")
  @APIResponse(responseCode = "204", description = "Epic deleted")
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_EPIC,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public void delete(@PathParam("id") UUID id) {
    respond(deleteEpic.delete(id));
  }

  /** Restores a deleted epic. */
  @POST
  @Path("/{id}/restore")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "restoreEpic",
      summary = "Restores a deleted epic; a no-op if it is not deleted")
  @APIResponse(
      responseCode = Responses.OK,
      description = "The epic",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = EpicResponse.class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = "No epic with this id in an active initiative of the user",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public EpicResponse restore(@PathParam("id") UUID id) {
    return respond(restoreEpic.restore(id));
  }

  private static EpicResponse respond(Optional<Epic> epic) {
    return epic.map(EpicResponse::from).orElseThrow(NotFoundException::new);
  }
}
