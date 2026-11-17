package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.FindTaskReservationsUseCase;
import br.com.davisoares.bouleplan.application.port.in.GetPlannerUseCase;
import br.com.davisoares.bouleplan.application.port.in.ListTaskScheduledItemsUseCase;
import br.com.davisoares.bouleplan.application.port.in.Planner;
import br.com.davisoares.bouleplan.application.port.in.TaskReservation;
import br.com.davisoares.bouleplan.application.port.out.CalendarEventRepository;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.ScheduledItemRepository;
import br.com.davisoares.bouleplan.application.port.out.TaskRepository;
import br.com.davisoares.bouleplan.domain.PlannerWeek;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Read use cases of the planner. */
@ApplicationScoped
public class PlannerService
    implements GetPlannerUseCase, ListTaskScheduledItemsUseCase, FindTaskReservationsUseCase {

  private final ScheduledItemRepository items;
  private final CalendarEventRepository events;
  private final TaskRepository tasks;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public PlannerService(
      ScheduledItemRepository items,
      CalendarEventRepository events,
      TaskRepository tasks,
      CurrentUser currentUser) {
    this.items = items;
    this.events = events;
    this.tasks = tasks;
    this.currentUser = currentUser;
  }

  @Override
  public Planner week(LocalDate weekStart) {
    LocalDate start = PlannerWeek.requireMonday(weekStart);
    LocalDate end = start.plusDays(PlannerWeek.DAYS - 1L);
    return new Planner(
        start,
        events.findByUserBetween(currentUser.id(), start, end),
        items.findVisibleBetween(currentUser.id(), start, end));
  }

  @Override
  public Optional<List<ScheduledItem>> findBlocksOf(UUID taskId) {
    return tasks
        .findVisibleByIdAndUser(taskId, currentUser.id())
        .map(task -> items.findVisibleBlocksOfTask(taskId, currentUser.id()));
  }

  @Override
  public Map<UUID, TaskReservation> findFor(Collection<UUID> taskIds) {
    return taskIds.isEmpty() ? Map.of() : items.sumReservations(taskIds);
  }
}
