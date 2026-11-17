package br.com.davisoares.bouleplan.domain;

/** Thrown when a well-formed scheduling request is not allowed by the state of its task. */
public class ScheduleRefusedException extends DomainRuleViolation {

  private static final long serialVersionUID = 1L;

  /** Creates the exception with the code and message of the violated rule. */
  public ScheduleRefusedException(String code, String message) {
    super(code, message);
  }

  /** A task that is done cannot be scheduled. */
  public static ScheduleRefusedException taskDone() {
    return new ScheduleRefusedException(
        "scheduled-item.task-done", "A task that is done cannot be scheduled");
  }
}
