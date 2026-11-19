package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.EpicRepository;
import br.com.davisoares.bouleplan.domain.Epic;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Panache implementation of {@link EpicRepository}. */
@ApplicationScoped
public class PanacheEpicRepository implements EpicRepository, PanacheRepositoryBase<Epic, UUID> {

  private static final String IN_ACTIVE_INITIATIVE_OF_USER =
      "id = ?1 and implicit = false and initiativeId in (select i.id from Initiative i"
          + " where i.userId = ?2 and i.archivedAt is null and i.deletedAt is null)";

  @Override
  public void save(Epic epic) {
    persist(epic);
  }

  @Override
  public List<Epic> findActiveNamedByInitiative(UUID initiativeId) {
    return list(
        "initiativeId = ?1 and implicit = false and archivedAt is null and deletedAt is null"
            + " order by createdAt, id",
        initiativeId);
  }

  @Override
  public Optional<Epic> findActiveNamedByIdAndUser(UUID id, UUID userId) {
    return find(
            IN_ACTIVE_INITIATIVE_OF_USER + " and archivedAt is null and deletedAt is null",
            id,
            userId)
        .firstResultOptional();
  }

  @Override
  public Optional<UUID> findInitiativeIdOfNamed(UUID id) {
    return getEntityManager()
        .createQuery(
            "select p.initiativeId from Epic p where p.id = ?1 and p.implicit = false", UUID.class)
        .setParameter(1, id)
        .getResultList()
        .stream()
        .findFirst();
  }

  @Override
  public Optional<Epic> findNamedByIdAndUserForUpdate(UUID id, UUID userId) {
    return find(IN_ACTIVE_INITIATIVE_OF_USER, id, userId)
        .withLock(LockModeType.PESSIMISTIC_WRITE)
        .firstResultOptional();
  }

  @Override
  public Optional<Epic> findByIdAndInitiativeForUpdate(UUID id, UUID initiativeId) {
    return find("id = ?1 and initiativeId = ?2", id, initiativeId)
        .withLock(LockModeType.PESSIMISTIC_WRITE)
        .firstResultOptional();
  }

  @Override
  public Optional<UUID> findImplicitIdByInitiative(UUID initiativeId) {
    return getEntityManager()
        .createQuery(
            "select p.id from Epic p where p.initiativeId = ?1 and p.implicit = true", UUID.class)
        .setParameter(1, initiativeId)
        .getResultList()
        .stream()
        .findFirst();
  }

  @Override
  public Optional<Epic> findImplicitByInitiativeForUpdate(UUID initiativeId) {
    return find("initiativeId = ?1 and implicit = true", initiativeId)
        .withLock(LockModeType.PESSIMISTIC_WRITE)
        .firstResultOptional();
  }
}
