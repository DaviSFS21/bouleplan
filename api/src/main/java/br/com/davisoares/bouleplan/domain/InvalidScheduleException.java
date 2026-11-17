package br.com.davisoares.bouleplan.domain;

/** Thrown when a calendar event, a scheduled item or a planner week is not valid. */
public class InvalidScheduleException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public InvalidScheduleException(String code, String message) {
    super(code, message);
  }
}
