package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.in.TaskReservation;
import br.com.davisoares.bouleplan.application.port.out.ScheduledItemRepository;
import br.com.davisoares.bouleplan.domain.ScheduledItem;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** Panache and native SQL implementation of {@link ScheduledItemRepository}. */
@SuppressWarnings("PMD.TooManyMethods") // one method per port query
@ApplicationScoped
public class PanacheScheduledItemRepository
    implements ScheduledItemRepository, PanacheRepositoryBase<ScheduledItem, UUID> {

  private static final String VISIBLE_TASK_IDS_OF_USER =
      "select t.id from Task t join t.epic p"
          + " where t.archivedAt is null and t.deletedAt is null"
          + " and p.archivedAt is null and p.deletedAt is null"
          + " and p.initiativeId in (select i.id from Initiative i"
          + " where i.userId = ?1 and i.archivedAt is null and i.deletedAt is null)";

  private static final String VISIBLE_SQL =
      " from scheduled_item si"
          + " join task t on t.id = si.task_id"
          + " join epic p on p.id = t.epic_id"
          + " join initiative i on i.id = p.initiative_id"
          + " where i.user_id = :user and i.archived_at is null and i.deleted_at is null"
          + " and p.archived_at is null and p.deleted_at is null"
          + " and t.archived_at is null and t.deleted_at is null";

  private static final String USER = "user";
  private static final String DATE = "date";

  private static final String OWN_TASK_IDS =
      "select t.id from task t join epic p on p.id = t.epic_id"
          + " join initiative i on i.id = p.initiative_id where i.user_id = :user";

  private static final String MINUTES = "extract(epoch from (si.end_time - si.start_time)) / 60";

  private final EntityManager entityManager;

  /** Wires the entity manager for the native queries. */
  public PanacheScheduledItemRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public void save(ScheduledItem item) {
    persist(item);
  }

  @Override
  public void remove(ScheduledItem item) {
    delete(item);
  }

  @Override
  public Optional<ScheduledItem> findAnyById(UUID id) {
    return findByIdOptional(id);
  }

  @Override
  public boolean hasDayListEntry(UUID taskId, LocalDate date, UUID exceptId) {
    return count(
            "taskId = ?1 and date = ?2 and startTime is null and id <> ?3", taskId, date, exceptId)
        > 0;
  }

  @Override
  public boolean hasBlockOverlapping(
      UUID userId, LocalDate date, LocalTime start, LocalTime end, UUID exceptId) {
    return (Boolean)
        entityManager
            .createNativeQuery(
                "select exists (select 1"
                    + VISIBLE_SQL
                    + " and si.date = :date and si.start_time is not null and si.id <> :except"
                    + " and si.start_time < :end and si.end_time > :start)")
            .setParameter(USER, userId)
            .setParameter(DATE, date)
            .setParameter("except", exceptId)
            .setParameter("start", start)
            .setParameter("end", end)
            .getSingleResult();
  }

  // Hidden items count too, so that bringing them back never ties with a visible entry.
  @Override
  public int nextSortOrder(UUID userId, LocalDate date) {
    return ((Number)
            entityManager
                .createNativeQuery(
                    "select coalesce(max(si.sort_order), -1) + 1"
                        + " from scheduled_item si"
                        + " join task t on t.id = si.task_id"
                        + " join epic p on p.id = t.epic_id"
                        + " join initiative i on i.id = p.initiative_id"
                        + " where i.user_id = :user and si.date = :date")
                .setParameter(USER, userId)
                .setParameter(DATE, date)
                .getSingleResult())
        .intValue();
  }

  @Override
  public boolean hasSortOrder(UUID userId, LocalDate date, int sortOrder, UUID exceptId) {
    return (Boolean)
        entityManager
            .createNativeQuery(
                "select exists (select 1 from scheduled_item si where si.date = :date"
                    + " and si.sort_order = :order and si.id <> :except"
                    + " and si.task_id in ("
                    + OWN_TASK_IDS
                    + "))")
            .setParameter(USER, userId)
            .setParameter(DATE, date)
            .setParameter("order", sortOrder)
            .setParameter("except", exceptId)
            .getSingleResult();
  }

  // Hidden entries shift too, so that bringing them back keeps the order they had relatively.
  @Override
  public void shiftSortOrders(
      UUID userId, LocalDate date, int low, int high, int delta, UUID exceptId) {
    entityManager
        .createNativeQuery(
            "update scheduled_item set sort_order = sort_order + :delta, updated_at = now()"
                + " where date = :date and sort_order between :low and :high and id <> :except"
                + " and task_id in ("
                + OWN_TASK_IDS
                + ")")
        .setParameter(USER, userId)
        .setParameter(DATE, date)
        .setParameter("low", low)
        .setParameter("high", high)
        .setParameter("delta", delta)
        .setParameter("except", exceptId)
        .executeUpdate();
  }

  @Override
  public List<ScheduledItem> findVisibleBetween(UUID userId, LocalDate from, LocalDate to) {
    return list(
        "date >= ?2 and date <= ?3 and taskId in ("
            + VISIBLE_TASK_IDS_OF_USER
            + ") order by date, sortOrder nulls last, startTime, createdAt, id",
        userId,
        from,
        to);
  }

  @Override
  public List<ScheduledItem> findVisibleBlocksOfTask(UUID taskId, UUID userId) {
    return list(
        "taskId = ?2 and startTime is not null and taskId in ("
            + VISIBLE_TASK_IDS_OF_USER
            + ") order by date, startTime, id",
        userId,
        taskId);
  }

  @Override
  @SuppressWarnings("unchecked") // a native query returns raw rows
  public Map<UUID, TaskReservation> sumReservations(Collection<UUID> taskIds) {
    List<Object[]> rows =
        entityManager
            .createNativeQuery(
                "select si.task_id, sum("
                    + MINUTES
                    + "), sum(case when t.deadline is null or si.date <= t.deadline then "
                    + MINUTES
                    + " else 0 end)"
                    + " from scheduled_item si join task t on t.id = si.task_id"
                    + " where si.task_id in (:ids) and si.start_time is not null"
                    + " group by si.task_id")
            .setParameter("ids", taskIds)
            .getResultList();
    return rows.stream()
        .collect(
            Collectors.toMap(
                row -> (UUID) row[0],
                row ->
                    new TaskReservation(
                        ((Number) row[1]).longValue(), ((Number) row[2]).longValue())));
  }
}
