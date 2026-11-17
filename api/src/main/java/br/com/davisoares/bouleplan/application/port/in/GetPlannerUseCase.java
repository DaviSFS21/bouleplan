package br.com.davisoares.bouleplan.application.port.in;

import java.time.LocalDate;

/** Reads the week of the planner. */
public interface GetPlannerUseCase {

  /**
   * The events and the items of visible tasks of the seven days from {@code weekStart}, which must
   * be a Monday. Items come sorted by date, day-list order, then start time.
   */
  Planner week(LocalDate weekStart);
}
