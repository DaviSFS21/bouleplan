package br.com.davisoares.bouleplan.domain;

/** Thrown when a scheduled item contradicts another one that is already stored. */
public class ScheduleConflictException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public ScheduleConflictException(String code, String message) {
    super(code, message);
  }

  /** A dedicated block would share time with another block of the user. */
  public static ScheduleConflictException overlap() {
    return new ScheduleConflictException(
        "scheduled-item.overlap", "Another dedicated block already uses part of this time");
  }

  /** The task is already in the list of that day. */
  public static ScheduleConflictException duplicate() {
    return new ScheduleConflictException(
        "scheduled-item.duplicate", "The task is already in the list of that day");
  }
}
