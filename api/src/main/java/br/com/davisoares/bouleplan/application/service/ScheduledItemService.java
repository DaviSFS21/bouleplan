package br.com.davisoares.bouleplan.application.service;

import br.com.davisoares.bouleplan.application.port.in.CreateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.in.ManageScheduledItemsUseCase;
import br.com.davisoares.bouleplan.application.port.in.UpdateScheduledItemCommand;
import br.com.davisoares.bouleplan.application.port.out.CurrentUser;
import br.com.davisoares.bouleplan.application.port.out.ScheduledItemRepository;
import br.com.davisoares.bouleplan.application.port.out.UserLock;
import br.com.davisoares.bouleplan.domain.InvalidScheduleException;
import br.com.davisoares.bouleplan.domain.ScheduleConflictException;
import br.com.davisoares.bouleplan.domain.ScheduleRefusedException;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
import br.com.davisoares.bouleplan.domain.Task;
import br.com.davisoares.bouleplan.domain.TaskStatus;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Use cases for the items of the planner. Every write takes the user lock first, so that the
 * overlap and duplicate checks cannot race another write, and then the chain of locks of the task.
 */
@SuppressWarnings("PMD.TooManyMethods") // three use cases plus one small check each
@ApplicationScoped
public class ScheduledItemService implements ManageScheduledItemsUseCase {

  private final ScheduledItemRepository items;
  private final TaskLocker locker;
  private final UserLock userLock;
  private final CurrentUser currentUser;

  /** Wires the outbound ports. */
  public ScheduledItemService(
      ScheduledItemRepository items,
      TaskLocker locker,
      UserLock userLock,
      CurrentUser currentUser) {
    this.items = items;
    this.locker = locker;
    this.userLock = userLock;
    this.currentUser = currentUser;
  }

  @Override
  @Transactional
  public Optional<ScheduledItem> create(CreateScheduledItemCommand command) {
    userLock.lock(currentUser.id());
    return lockedTask(command.taskId())
        .map(task -> {
          requireSchedulable(task);
          ScheduledItem item =
              command.startTime() == null && command.endTime() == null
                  ? newDayListEntry(task.getId(), command.date())
                  : newBlock(task.getId(), command);
          items.save(item);
          return item;
        });
  }

  @Override
  @Transactional
  public Optional<ScheduledItem> update(UUID id, UpdateScheduledItemCommand command) {
    userLock.lock(currentUser.id());
    return items
        .findAnyById(id)
        .flatMap(item ->
            lockedTask(item.getTaskId())
                .map(task -> {
                  requireSchedulable(task);
                  apply(item, command);
                  return item;
                }));
  }

  @Override
  @Transactional
  public boolean delete(UUID id) {
    userLock.lock(currentUser.id());
    return items
        .findAnyById(id)
        .filter(item -> lockedTask(item.getTaskId()).isPresent())
        .map(item -> {
          items.remove(item);
          return true;
        })
        .orElse(false);
  }

  private ScheduledItem newDayListEntry(UUID taskId, LocalDate date) {
    int order = items.nextSortOrder(currentUser.id(), date);
    ScheduledItem.requireDayListEntry(date, order);
    requireNoDuplicate(taskId, date, ScheduledItemRepository.NO_ITEM);
    return ScheduledItem.dayListEntry(taskId, date, order);
  }

  private ScheduledItem newBlock(UUID taskId, CreateScheduledItemCommand command) {
    ScheduledItem.requireBlock(command.date(), command.startTime(), command.endTime());
    requireNoOverlap(
        command.date(), command.startTime(), command.endTime(), ScheduledItemRepository.NO_ITEM);
    return ScheduledItem.block(taskId, command.date(), command.startTime(), command.endTime());
  }

  private void apply(ScheduledItem item, UpdateScheduledItemCommand command) {
    LocalDate date = command.date().present() ? command.date().value() : item.getDate();
    LocalTime start =
        command.startTime().present() ? command.startTime().value() : item.getStartTime();
    LocalTime end = command.endTime().present() ? command.endTime().value() : item.getEndTime();
    if (start == null && end == null) {
      moveInDayList(item, date, command);
    } else {
      moveAsBlock(item, date, start, end, command);
    }
  }

  // A kept order stays only on the same day; any other move, or a null order, appends.
  private void moveInDayList(
      ScheduledItem item, LocalDate date, UpdateScheduledItemCommand command) {
    boolean sameList = !item.isBlock() && date.equals(item.getDate());
    int order;
    if (command.sortOrder().present() && command.sortOrder().value() != null) {
      order = command.sortOrder().value();
    } else if (sameList && !command.sortOrder().present()) {
      order = item.getSortOrder();
    } else {
      order = items.nextSortOrder(currentUser.id(), date);
    }
    ScheduledItem.requireDayListEntry(date, order);
    requireNoDuplicate(item.getTaskId(), date, item.getId());
    if (command.sortOrder().present() && command.sortOrder().value() != null) {
      makeRoom(item, date, order, sameList);
    }
    item.placeInDayList(date, order);
  }

  // A reorder inside the day moves the entries between the two places by one, so that moving back
  // restores the list; an entry coming from elsewhere pushes the entries from its order upwards.
  private void makeRoom(ScheduledItem item, LocalDate date, int order, boolean sameList) {
    UUID user = currentUser.id();
    if (!items.hasSortOrder(user, date, order, item.getId())) {
      return;
    }
    if (sameList) {
      shiftBetween(item, date, order);
    } else {
      items.shiftSortOrders(user, date, order, Integer.MAX_VALUE, 1, item.getId());
    }
  }

  private void shiftBetween(ScheduledItem item, LocalDate date, int order) {
    int old = item.getSortOrder();
    if (order < old) {
      items.shiftSortOrders(currentUser.id(), date, order, old - 1, 1, item.getId());
    } else {
      items.shiftSortOrders(currentUser.id(), date, old + 1, order, -1, item.getId());
    }
  }

  private void moveAsBlock(
      ScheduledItem item,
      LocalDate date,
      LocalTime start,
      LocalTime end,
      UpdateScheduledItemCommand command) {
    if (command.sortOrder().present() && command.sortOrder().value() != null) {
      throw new InvalidScheduleException(
          "scheduled-item.time.invalid", "A dedicated block has no day-list order");
    }
    ScheduledItem.requireBlock(date, start, end);
    requireNoOverlap(date, start, end, item.getId());
    item.placeAsBlock(date, start, end);
  }

  private void requireNoDuplicate(UUID taskId, LocalDate date, UUID exceptId) {
    if (items.hasDayListEntry(taskId, date, exceptId)) {
      throw ScheduleConflictException.duplicate();
    }
  }

  private void requireNoOverlap(LocalDate date, LocalTime start, LocalTime end, UUID exceptId) {
    if (items.hasBlockOverlapping(currentUser.id(), date, start, end, exceptId)) {
      throw ScheduleConflictException.overlap();
    }
  }

  private static void requireSchedulable(Task task) {
    if (task.getStatus() == TaskStatus.DONE) {
      throw ScheduleRefusedException.taskDone();
    }
  }

  private Optional<Task> lockedTask(UUID taskId) {
    return locker.lock(taskId).filter(Task::isActive);
  }
}
