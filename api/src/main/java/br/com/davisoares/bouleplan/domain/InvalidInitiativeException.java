package br.com.davisoares.bouleplan.domain;

/** Thrown when an initiative would violate a domain invariant. */
public class InvalidInitiativeException extends RuntimeException {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the violated rule as message. */
  public InvalidInitiativeException(String message) {
    super(message);
  }
}
