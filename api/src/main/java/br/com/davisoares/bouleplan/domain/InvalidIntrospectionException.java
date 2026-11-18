package br.com.davisoares.bouleplan.domain;

/** Thrown when the week or an answer of an introspection sheet is not valid. */
public class InvalidIntrospectionException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public InvalidIntrospectionException(String code, String message) {
    super(code, message);
  }
}
