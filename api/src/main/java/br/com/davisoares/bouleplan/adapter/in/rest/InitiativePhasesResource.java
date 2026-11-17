package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreatePhaseUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListPhasesUseCase;
import br.com.davisoares.bouleplan.domain.Phase;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.headers.Header;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestResponse;

/** REST adapter for the phases of an initiative. */
@Path("/initiatives/{id}/phases")
@Tag(name = "Phases")
public class InitiativePhasesResource {

  private final ListPhasesUseCase listPhases;
  private final CreatePhaseUseCase createPhase;

  /** Wires the inbound ports. */
  public InitiativePhasesResource(ListPhasesUseCase listPhases, CreatePhaseUseCase createPhase) {
    this.listPhases = listPhases;
    this.createPhase = createPhase;
  }

  /** Lists the active named phases of an active initiative, oldest first. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listPhases",
      summary = "Lists the active phases of an active initiative in creation order")
  @APIResponse(
      responseCode = Responses.OK,
      description = "Active named phases",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = PhaseResponse[].class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_ACTIVE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public List<PhaseResponse> list(@PathParam("id") UUID initiativeId) {
    return listPhases.listActive(initiativeId).orElseThrow(NotFoundException::new).stream()
        .map(PhaseResponse::from)
        .toList();
  }

  /** Adds a named phase to an active initiative. */
  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "createPhase", summary = "Creates a phase in an active initiative")
  @APIResponse(
      responseCode = "201",
      description = "Phase created",
      headers = @Header(name = "Location", description = "URI of the created phase"),
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
      description = Responses.NO_ACTIVE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public RestResponse<PhaseResponse> create(
      @PathParam("id") UUID initiativeId, CreatePhaseRequest request) {
    if (request == null) {
      throw new MalformedRequestException();
    }
    Phase created =
        createPhase.create(initiativeId, request.name()).orElseThrow(NotFoundException::new);
    return RestResponse.ResponseBuilder.<PhaseResponse>created(
            URI.create("/phases/" + created.getId()))
        .entity(PhaseResponse.from(created))
        .build();
  }
}
