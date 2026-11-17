package br.com.davisoares.bouleplan.application.port.in;

/**
 * The minutes of dedicated blocks a task has: all of them, and those dated on or before its
 * deadline (all of them when it has none).
 */
public record TaskReservation(long reservedMinutes, long reservedByDeadlineMinutes) {

  /** A task without blocks. */
  public static final TaskReservation NONE = new TaskReservation(0, 0);
}
