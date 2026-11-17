package br.com.davisoares.bouleplan.domain;

import java.time.LocalDate;
import java.util.Objects;

/** A planner week starts on a Monday. */
public final class PlannerWeek {

  /** Days in a week. */
  public static final int DAYS = 7;

  private PlannerWeek() {}

  /** The date itself, or a violation with the code {@code planner.week.invalid}. */
  public static LocalDate requireMonday(LocalDate weekStart) {
    if (Objects.isNull(weekStart)
        || !CalendarDates.isMonday(weekStart)
        || !EntityText.hasValidYear(weekStart)) {
      throw new InvalidScheduleException(
          "planner.week.invalid",
          "The week must start on a Monday with a year between "
              + EntityText.MIN_DEADLINE_YEAR
              + " and "
              + EntityText.MAX_DEADLINE_YEAR);
    }
    return weekStart;
  }
}
