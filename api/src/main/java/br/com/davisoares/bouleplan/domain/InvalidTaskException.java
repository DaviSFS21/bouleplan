package br.com.davisoares.bouleplan.domain;

/** Thrown when a task would violate a domain invariant. */
public class InvalidTaskException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public InvalidTaskException(String code, String message) {
    super(code, message);
  }
}
