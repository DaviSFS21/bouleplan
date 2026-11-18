package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.application.port.in.CreateEpicUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListEpicsUseCase;
import br.com.davisoares.bouleplan.domain.Epic;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.eclipse.microprofile.openapi.annotations.parameters.RequestBody;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.eclipse.microprofile.openapi.annotations.tags.Tag;
import org.jboss.resteasy.reactive.RestResponse;

/** REST adapter for the epics of an initiative. */
@Path("/initiatives/{id}/epics")
@Tag(name = "Epics")
public class InitiativeEpicsResource {

  private final ListEpicsUseCase listEpics;
  private final CreateEpicUseCase createEpic;
  private final ObjectMapper objectMapper;

  /** Wires the inbound ports. */
  public InitiativeEpicsResource(
      ListEpicsUseCase listEpics, CreateEpicUseCase createEpic, ObjectMapper objectMapper) {
    this.listEpics = listEpics;
    this.createEpic = createEpic;
    this.objectMapper = objectMapper;
  }

  /** Lists the active named epics of an active initiative, oldest first. */
  @GET
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(
      operationId = "listEpics",
      summary = "Lists the active epics of an active initiative in creation order")
  @APIResponse(
      responseCode = Responses.OK,
      description = "Active named epics",
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = EpicResponse[].class)))
  @APIResponse(
      responseCode = Responses.NOT_FOUND,
      description = Responses.NO_ACTIVE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public List<EpicResponse> list(@PathParam("id") UUID initiativeId) {
    return listEpics.listActive(initiativeId).orElseThrow(NotFoundException::new).stream()
        .map(EpicResponse::from)
        .toList();
  }

  /** Adds a named epic to an active initiative. */
  @POST
  @Consumes(MediaType.APPLICATION_JSON)
  @Produces(MediaType.APPLICATION_JSON)
  @Operation(operationId = "createEpic", summary = "Creates an epic in an active initiative")
  @RequestBody(
      required = true,
      content =
          @Content(
              mediaType = MediaType.APPLICATION_JSON,
              schema = @Schema(implementation = CreateEpicRequest.class)))
  @APIResponse(
      responseCode = "201",
      description = "Epic created",
      headers = @Header(name = "Location", description = "URI of the created epic"),
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
      description = Responses.NO_ACTIVE,
      content =
          @Content(
              mediaType = Problem.MEDIA_TYPE,
              schema = @Schema(implementation = Problem.class)))
  public RestResponse<EpicResponse> create(@PathParam("id") UUID initiativeId, String body) {
    Epic created =
        createEpic
            .create(initiativeId, JsonBodies.createName(objectMapper, body))
            .orElseThrow(NotFoundException::new);
    return RestResponse.ResponseBuilder.<EpicResponse>created(
            URI.create("/epics/" + created.getId()))
        .entity(EpicResponse.from(created))
        .build();
  }
}
