package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.application.port.in.UpdateInitiativeCommand.Change;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Partial update of an item: an absent change leaves the field alone. Both times {@code null} make
 * a day-list entry, both set make a block.
 */
public record UpdateScheduledItemCommand(
    Change<LocalDate> date,
    Change<LocalTime> startTime,
    Change<LocalTime> endTime,
    Change<Integer> sortOrder) {}
