package br.com.davisoares.bouleplan.domain;

/** Thrown when an epic would violate a domain invariant. */
public class InvalidEpicException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public InvalidEpicException(String code, String message) {
    super(code, message);
  }
}
