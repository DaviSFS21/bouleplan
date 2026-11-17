package br.com.davisoares.bouleplan.domain;

import java.time.LocalDate;
import java.time.LocalTime;

/** The rule shared by events and blocks: quarter hours within one day, start before end. */
final class TimeSlot {

  private static final int QUARTER = 15;

  private TimeSlot() {}

  static boolean isValid(LocalDate date, LocalTime start, LocalTime end) {
    return date != null
        && EntityText.hasValidYear(date)
        && isQuarterHour(start)
        && isQuarterHour(end)
        && start.isBefore(end);
  }

  static boolean isQuarterHour(LocalTime time) {
    return time != null
        && time.getMinute() % QUARTER == 0
        && time.getSecond() == 0
        && time.getNano() == 0;
  }
}
