package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.InvalidInitiativeException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.exc.MismatchedInputException;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.RestResponse;
import org.jboss.resteasy.reactive.server.ServerExceptionMapper;

/** Translates exceptions into RFC 9457 problem responses. */
public class ProblemExceptionMappers {

  private static final Logger LOG = Logger.getLogger(ProblemExceptionMappers.class);

  /** Domain rule violation. */
  @ServerExceptionMapper
  public RestResponse<Problem> invalidInitiative(InvalidInitiativeException exception) {
    return problem(
        400, "/problems/invalid-initiative", "Invalid initiative", exception.getMessage());
  }

  /** Mistyped JSON body; outranks Quarkus' built-in mapper, which answers with plain JSON. */
  @ServerExceptionMapper(priority = Priorities.USER - 1)
  public RestResponse<Problem> mismatchedInput(MismatchedInputException exception) {
    return malformedRequest();
  }

  /** Request without a body. */
  @ServerExceptionMapper
  public RestResponse<Problem> missingBody(MalformedRequestException exception) {
    return malformedRequest();
  }

  /** Framework-level HTTP errors (404, 405, 415...) keep their own status. */
  @ServerExceptionMapper
  public RestResponse<Problem> webApplication(WebApplicationException exception) {
    Response response = exception.getResponse();
    return exception.getCause() instanceof JsonProcessingException
        ? malformedRequest()
        : problem(
            response.getStatus(),
            "/problems/http-error",
            response.getStatusInfo().getReasonPhrase(),
            "The request could not be processed");
  }

  /** Anything else; the message is logged, never returned. */
  @ServerExceptionMapper
  public RestResponse<Problem> internal(Exception exception) {
    LOG.error("Unexpected error", exception);
    return problem(500, "/problems/internal", "Internal error", "An unexpected error occurred");
  }

  private static RestResponse<Problem> malformedRequest() {
    return problem(
        400, "/problems/malformed-request", "Malformed request", "The request body is not valid");
  }

  private static RestResponse<Problem> problem(
      int status, String type, String title, String detail) {
    return RestResponse.ResponseBuilder.<Problem>create(status)
        .entity(new Problem(type, title, status, detail))
        .type(Problem.MEDIA_TYPE)
        .build();
  }
}
