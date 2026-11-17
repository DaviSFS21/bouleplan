package br.com.davisoares.bouleplan.application.port.in;

import java.time.LocalDate;
import java.time.LocalTime;

/** A new fixed event; the domain validates the fields. */
public record CreateCalendarEventCommand(
    String title, LocalDate date, LocalTime startTime, LocalTime endTime) {}
