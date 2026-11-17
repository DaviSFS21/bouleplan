package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.CalendarEvent;
import java.util.Optional;
import java.util.UUID;

/** Creates, edits and removes the fixed events of the current user. */
public interface ManageCalendarEventsUseCase {

  /** Creates an event. */
  CalendarEvent create(CreateCalendarEventCommand command);

  /** Edits an event of the user; empty if there is none. */
  Optional<CalendarEvent> update(UUID id, UpdateCalendarEventCommand command);

  /** Deletes an event of the user; false if there is none. */
  boolean delete(UUID id);
}
