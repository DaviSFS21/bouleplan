package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.TaskLocation;
import br.com.davisoares.bouleplan.application.port.out.TaskRepository;
import br.com.davisoares.bouleplan.domain.Task;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Panache implementation of {@link TaskRepository}. */
@ApplicationScoped
public class PanacheTaskRepository implements TaskRepository, PanacheRepositoryBase<Task, UUID> {

  private static final String VISIBLE_OF_USER =
      "select t from Task t join fetch t.phase p"
          + " where t.archivedAt is null and t.deletedAt is null"
          + " and p.archivedAt is null and p.deletedAt is null"
          + " and p.initiativeId in (select i.id from Initiative i"
          + " where i.userId = ?1 and i.archivedAt is null and i.deletedAt is null)";

  @Override
  public void save(Task task) {
    persist(task);
  }

  @Override
  public List<Task> findVisibleByUser(UUID userId) {
    return list(
        VISIBLE_OF_USER + " order by t.priority, t.deadline nulls last, t.createdAt, t.id", userId);
  }

  @Override
  public Optional<Task> findVisibleByIdAndUser(UUID id, UUID userId) {
    return find(VISIBLE_OF_USER + " and t.id = ?2", userId, id).firstResultOptional();
  }

  @Override
  public Optional<TaskLocation> findLocation(UUID id) {
    return getEntityManager()
        .createQuery(
            "select p.id, p.initiativeId from Task t join t.phase p where t.id = ?1",
            Object[].class)
        .setParameter(1, id)
        .getResultList()
        .stream()
        .findFirst()
        .map(row -> new TaskLocation((UUID) row[0], (UUID) row[1]));
  }

  @Override
  public Optional<Task> findByIdForUpdate(UUID id) {
    return find("id = ?1", id).withLock(LockModeType.PESSIMISTIC_WRITE).firstResultOptional();
  }
}
