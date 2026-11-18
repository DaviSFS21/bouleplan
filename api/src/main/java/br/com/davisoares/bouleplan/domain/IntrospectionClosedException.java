package br.com.davisoares.bouleplan.domain;

/** Thrown when a closed introspection sheet is changed or closed again. */
public class IntrospectionClosedException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the fixed code {@code introspection.closed}. */
  public IntrospectionClosedException() {
    super("introspection.closed", "A closed sheet cannot change");
  }
}
