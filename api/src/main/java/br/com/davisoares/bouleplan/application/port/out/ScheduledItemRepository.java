package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.application.port.in.TaskReservation;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistence port for scheduled items. Items of hidden tasks (a task, epic or initiative that is
 * archived or deleted) are hidden: the queries that say "visible" leave them out.
 */
@SuppressWarnings("PMD.TooManyMethods") // one method per query of the planner
public interface ScheduledItemRepository {

  /** Stands for "no item" where a query excludes one. */
  UUID NO_ITEM = new UUID(0L, 0L);

  /** Persists a new item. */
  void save(ScheduledItem item);

  /** Deletes the item. */
  void remove(ScheduledItem item);

  /** An item in any state by id. */
  Optional<ScheduledItem> findAnyById(UUID id);

  /** Whether the task is in the list of the date through an item other than {@code exceptId}. */
  boolean hasDayListEntry(UUID taskId, LocalDate date, UUID exceptId);

  /** Whether a visible block of the user other than {@code exceptId} shares time with this one. */
  boolean hasBlockOverlapping(
      UUID userId, LocalDate date, LocalTime start, LocalTime end, UUID exceptId);

  /** One more than the highest day-list order of the user on the date, 0 if there is none. */
  int nextSortOrder(UUID userId, LocalDate date);

  /** Whether a day-list entry of the user other than {@code exceptId} has this order that day. */
  boolean hasSortOrder(UUID userId, LocalDate date, int sortOrder, UUID exceptId);

  /**
   * Adds {@code delta} to the order of the user's day-list entries on the date whose order is from
   * {@code low} to {@code high}, both inclusive, except one item.
   */
  void shiftSortOrders(UUID userId, LocalDate date, int low, int high, int delta, UUID exceptId);

  /** The visible items of the user from {@code from} to {@code to}, both inclusive, sorted. */
  List<ScheduledItem> findVisibleBetween(UUID userId, LocalDate from, LocalDate to);

  /** The visible blocks of a task of the user by date and start. */
  List<ScheduledItem> findVisibleBlocksOfTask(UUID taskId, UUID userId);

  /** The reserved time of the tasks that have blocks, in one grouped query. */
  Map<UUID, TaskReservation> sumReservations(Collection<UUID> taskIds);
}
