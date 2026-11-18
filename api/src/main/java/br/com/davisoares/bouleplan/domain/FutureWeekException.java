package br.com.davisoares.bouleplan.domain;

/** Thrown when a sheet of a week that has not started yet is closed. */
public class FutureWeekException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the fixed code {@code introspection.week.future}. */
  public FutureWeekException() {
    super("introspection.week.future", "A week that has not started cannot be closed");
  }
}
