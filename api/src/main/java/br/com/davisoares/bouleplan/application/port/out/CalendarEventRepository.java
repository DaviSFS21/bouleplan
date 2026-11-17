package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.CalendarEvent;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for calendar events. */
public interface CalendarEventRepository {

  /** Persists a new event. */
  void save(CalendarEvent event);

  /** Deletes the event. */
  void remove(CalendarEvent event);

  /** An event by id, if it is the user's. */
  Optional<CalendarEvent> findByIdAndUser(UUID id, UUID userId);

  /** The user's events from {@code from} to {@code to}, both inclusive, by date and start. */
  List<CalendarEvent> findByUserBetween(UUID userId, LocalDate from, LocalDate to);
}
