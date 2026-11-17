package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import java.time.LocalDate;
import java.time.LocalTime;

/** Partial update of a fixed event: an absent change leaves the field alone. */
public record UpdateCalendarEventCommand(
    Change<String> title,
    Change<LocalDate> date,
    Change<LocalTime> startTime,
    Change<LocalTime> endTime) {}
