package br.com.davisoares.bouleplan.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** Date rules shared by the planner and planned weeks. */
public final class CalendarDates {

  private CalendarDates() {}

  /** Whether the date is a Monday, the first day of a planner week. */
  public static boolean isMonday(LocalDate date) {
    // By number: Sonar wants equals() on DayOfWeek, PMD wants == on enums.
    return date.getDayOfWeek().getValue() == DayOfWeek.MONDAY.getValue();
  }
}
