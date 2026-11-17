package br.com.davisoares.bouleplan.adapter.in.rest;

import br.com.davisoares.bouleplan.domain.DomainRuleViolation;
import br.com.davisoares.bouleplan.domain.ScheduleConflictException;
import br.com.davisoares.bouleplan.domain.ScheduleRefusedException;
import br.com.davisoares.bouleplan.domain.TaskBlockerException;
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

  private static final String RULE_VIOLATION_TYPE = "/problems/rule-violation";
  private static final String RULE_VIOLATION_TITLE = "Rule violation";
  private static final Logger LOG = Logger.getLogger(ProblemExceptionMappers.class);

  /** Any broken domain rule. */
  @ServerExceptionMapper
  public RestResponse<Problem> ruleViolation(DomainRuleViolation exception) {
    return problem(
        400, RULE_VIOLATION_TYPE, RULE_VIOLATION_TITLE, exception.code(), exception.getMessage());
  }

  /** A blocker link that is not allowed: well-formed, but it contradicts the existing links. */
  @ServerExceptionMapper
  public RestResponse<Problem> blockerRefused(TaskBlockerException exception) {
    return problem(
        422, RULE_VIOLATION_TYPE, RULE_VIOLATION_TITLE, exception.code(), exception.getMessage());
  }

  /** A scheduled item that contradicts another one: an overlap or a duplicate. */
  @ServerExceptionMapper
  public RestResponse<Problem> scheduleConflict(ScheduleConflictException exception) {
    return problem(
        409, RULE_VIOLATION_TYPE, RULE_VIOLATION_TITLE, exception.code(), exception.getMessage());
  }

  /** A scheduling request that the state of the task does not allow. */
  @ServerExceptionMapper
  public RestResponse<Problem> scheduleRefused(ScheduleRefusedException exception) {
    return problem(
        422, RULE_VIOLATION_TYPE, RULE_VIOLATION_TITLE, exception.code(), exception.getMessage());
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
            "http." + response.getStatus(),
            "The request could not be processed");
  }

  /** Anything else; the message is logged, never returned. */
  @ServerExceptionMapper
  public RestResponse<Problem> internal(Exception exception) {
    LOG.error("Unexpected error", exception);
    return problem(
        500, "/problems/internal", "Internal error", "internal", "An unexpected error occurred");
  }

  private static RestResponse<Problem> malformedRequest() {
    return problem(
        400,
        "/problems/malformed-request",
        "Malformed request",
        "http.400",
        "The request body is not valid");
  }

  private static RestResponse<Problem> problem(
      int status, String type, String title, String code, String detail) {
    return RestResponse.ResponseBuilder.<Problem>create(status)
        .entity(new Problem(type, title, status, detail, code))
        .type(Problem.MEDIA_TYPE)
        .build();
  }
}
