package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.TaskBlockerLink;
import br.com.davisoares.bouleplan.application.port.out.TaskBlockerRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.EntityManager;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Native SQL implementation of {@link TaskBlockerRepository} over the {@code task_blocker} table.
 */
@ApplicationScoped
public class PostgresTaskBlockerRepository implements TaskBlockerRepository {

  private static final String BLOCKING = "blocking";
  private static final String BLOCKED = "blocked";

  private final EntityManager entityManager;

  /** Wires the entity manager. */
  public PostgresTaskBlockerRepository(EntityManager entityManager) {
    this.entityManager = entityManager;
  }

  @Override
  public void add(UUID blockingId, UUID blockedId) {
    entityManager
        .createNativeQuery(
            "insert into task_blocker (blocking_task_id, blocked_task_id)"
                + " values (:blocking, :blocked) on conflict do nothing")
        .setParameter(BLOCKING, blockingId)
        .setParameter(BLOCKED, blockedId)
        .executeUpdate();
  }

  @Override
  public void remove(UUID blockingId, UUID blockedId) {
    entityManager
        .createNativeQuery(
            "delete from task_blocker"
                + " where blocking_task_id = :blocking and blocked_task_id = :blocked")
        .setParameter(BLOCKING, blockingId)
        .setParameter(BLOCKED, blockedId)
        .executeUpdate();
  }

  @Override
  public boolean reaches(UUID fromTaskId, UUID toTaskId) {
    return (Boolean)
        entityManager
            .createNativeQuery(
                "with recursive reach(id) as ("
                    + " select blocked_task_id from task_blocker where blocking_task_id = :from"
                    + " union"
                    + " select b.blocked_task_id from task_blocker b"
                    + " join reach r on b.blocking_task_id = r.id)"
                    + " select exists (select 1 from reach where id = :to)")
            .setParameter("from", fromTaskId)
            .setParameter("to", toTaskId)
            .getSingleResult();
  }

  @Override
  @SuppressWarnings("unchecked") // a native query returns raw rows
  public List<TaskBlockerLink> findOfUser(UUID userId) {
    List<Object[]> rows =
        entityManager
            .createNativeQuery(
                "select b.blocking_task_id, b.blocked_task_id from task_blocker b"
                    + " join task t on t.id = b.blocking_task_id"
                    + " join phase p on p.id = t.phase_id"
                    + " join initiative i on i.id = p.initiative_id"
                    + " where i.user_id = :user")
            .setParameter("user", userId)
            .getResultList();
    return rows.stream().map(row -> new TaskBlockerLink((UUID) row[0], (UUID) row[1])).toList();
  }

  @Override
  @SuppressWarnings("unchecked") // a native query returns raw rows
  public List<TaskBlockerLink> findTouching(Collection<UUID> taskIds) {
    List<Object[]> rows =
        entityManager
            .createNativeQuery(
                "select blocking_task_id, blocked_task_id from task_blocker"
                    + " where blocking_task_id in (:ids) or blocked_task_id in (:ids)")
            .setParameter("ids", taskIds)
            .getResultList();
    return rows.stream().map(row -> new TaskBlockerLink((UUID) row[0], (UUID) row[1])).toList();
  }
}
