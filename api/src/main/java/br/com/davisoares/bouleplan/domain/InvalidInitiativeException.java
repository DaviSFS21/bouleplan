package br.com.davisoares.bouleplan.domain;

/** Thrown when an initiative would violate a domain invariant. */
public class InvalidInitiativeException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public InvalidInitiativeException(String code, String message) {
    super(code, message);
  }
}
