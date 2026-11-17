package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.CalendarEventRepository;
import br.com.davisoares.bouleplan.domain.CalendarEvent;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Panache implementation of {@link CalendarEventRepository}. */
@ApplicationScoped
public class PanacheCalendarEventRepository
    implements CalendarEventRepository, PanacheRepositoryBase<CalendarEvent, UUID> {

  @Override
  public void save(CalendarEvent event) {
    persist(event);
  }

  @Override
  public void remove(CalendarEvent event) {
    delete(event);
  }

  @Override
  public Optional<CalendarEvent> findByIdAndUser(UUID id, UUID userId) {
    return find("id = ?1 and userId = ?2", id, userId).firstResultOptional();
  }

  @Override
  public List<CalendarEvent> findByUserBetween(UUID userId, LocalDate from, LocalDate to) {
    return list(
        "userId = ?1 and date >= ?2 and date <= ?3 order by date, startTime, createdAt, id",
        userId,
        from,
        to);
  }
}
