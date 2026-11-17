package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.CreateCalendarEventCommand;
import br.com.davisoares.bouleplan.application.port.in.ManageCalendarEventsUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateCalendarEventCommand;
import br.com.davisoares.bouleplan.application.port.out.CalendarEventRepository;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.CalendarEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.util.Optional;
import java.util.UUID;

/** Use cases for the fixed events of the planner. */
@ApplicationScoped
public class CalendarEventService implements ManageCalendarEventsUseCase {

  private final CalendarEventRepository events;
  private final UserLock userLock;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public CalendarEventService(
      CalendarEventRepository events, UserLock userLock, CurrentUser currentUser) {
    this.events = events;
    this.userLock = userLock;
    this.currentUser = currentUser;
  }

  @Override
  @Transactional
  public CalendarEvent create(CreateCalendarEventCommand command) {
    userLock.lock(currentUser.id());
    CalendarEvent event =
        CalendarEvent.create(
            currentUser.id(),
            command.title(),
            command.date(),
            command.startTime(),
            command.endTime());
    events.save(event);
    return event;
  }

  @Override
  @Transactional
  public Optional<CalendarEvent> update(UUID id, UpdateCalendarEventCommand command) {
    userLock.lock(currentUser.id());
    return events
        .findByIdAndUser(id, currentUser.id())
        .map(event -> {
          if (command.title().present()) {
            event.rename(command.title().value());
          }
          event.reschedule(
              command.date().present() ? command.date().value() : event.getDate(),
              command.startTime().present() ? command.startTime().value() : event.getStartTime(),
              command.endTime().present() ? command.endTime().value() : event.getEndTime());
          return event;
        });
  }

  @Override
  @Transactional
  public boolean delete(UUID id) {
    userLock.lock(currentUser.id());
    return events
        .findByIdAndUser(id, currentUser.id())
        .map(event -> {
          events.remove(event);
          return true;
        })
        .orElse(false);
  }
}
