package br.com.davisoares.bouleplan.domain;

/** Thrown when a phase would violate a domain invariant. */
public class InvalidPhaseException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public InvalidPhaseException(String code, String message) {
    super(code, message);
  }
}
