package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreateInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetInitiativeUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListInitiativesUseCase;
import br.com.davisoares.bouleplan.domain.Initiative;
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

/** REST adapter for initiatives. */
@Path("/initiatives")
@Tag(name = "Initiatives")
public class InitiativeResource {

  private final CreateInitiativeUseCase createInitiative;
  private final ListInitiativesUseCase listInitiatives;
  private final GetInitiativeUseCase getInitiative;

  /** Wires the inbound ports. */
  public InitiativeResource(
      CreateInitiativeUseCase createInitiative,
      ListInitiativesUseCase listInitiatives,
      GetInitiativeUseCase getInitiative) {
    this.getInitiative = getInitiative;
    this.createInitiative = createInitiative;
    this.listInitiatives = listInitiatives;
  }

  /** Lists the active initiatives, oldest first. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listInitiatives",
      summary = "Lists active initiatives in creation order")
  @APIResponse(
      responseCode = "200",
      description = "Active initiatives",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = InitiativeResponse[].class)))
  public List<InitiativeResponse> list() {
    return listInitiatives.listActive().stream().map(InitiativeResponse::from).toList();
  }

  /** Returns one active initiative of the current user. */
  @GET
  @Path("/{id}")
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "getInitiative", summary = "Gets an active initiative by id")
  @APIResponse(
      responseCode = "200",
      description = "The initiative",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = InitiativeResponse.class)))
  @APIResponse(
      responseCode = "404",
      description = "No active initiative with this id",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public InitiativeResponse get(@PathParam("id") UUID id) {
    return getInitiative.find(id).map(InitiativeResponse::from).orElseThrow(NotFoundException::new);
  }

  /** Creates an initiative with an automatically suggested color. */
  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "createInitiative", summary = "Creates an initiative")
  @APIResponse(
      responseCode = "201",
      description = "Initiative created",
      headers = @Header(name = "Location", description = "URI of the created initiative"),
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = InitiativeResponse.class)))
  @APIResponse(
      responseCode = "400",
      description = "Rule violation or malformed request",
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public RestResponse<InitiativeResponse> create(CreateInitiativeRequest request) {
    if (request == null) {
      throw new MalformedRequestException();
    }
    Initiative created = createInitiative.create(request.name());
    return RestResponse.ResponseBuilder.<InitiativeResponse>created(
            URI.create("/initiatives/" + created.getId()))
        .entity(InitiativeResponse.from(created))
        .build();
  }
}
