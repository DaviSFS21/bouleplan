package br.com.davisoares.bouleplan.domain;

/** Thrown when a blocker link between tasks is not allowed. */
public class TaskBlockerException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public TaskBlockerException(String code, String message) {
    super(code, message);
  }

  /** A task cannot block itself. */
  public static TaskBlockerException self() {
    return new TaskBlockerException("task.blocker.self", "A task cannot block itself");
  }

  /** The blocked task already blocks the blocking one, directly or through other tasks. */
  public static TaskBlockerException cycle() {
    return new TaskBlockerException(
        "task.blocker.cycle", "The link would make the tasks wait for each other");
  }
}
