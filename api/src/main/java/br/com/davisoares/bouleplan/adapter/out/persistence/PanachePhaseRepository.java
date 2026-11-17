package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.PhaseRepository;
import br.com.davisoares.bouleplan.domain.Phase;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Panache implementation of {@link PhaseRepository}. */
@ApplicationScoped
public class PanachePhaseRepository implements PhaseRepository, PanacheRepositoryBase<Phase, UUID> {

  private static final String IN_ACTIVE_INITIATIVE_OF_USER =
      "id = ?1 and implicit = false and initiativeId in (select i.id from Initiative i"
          + " where i.userId = ?2 and i.archivedAt is null and i.deletedAt is null)";

  @Override
  public void save(Phase phase) {
    persist(phase);
  }

  @Override
  public List<Phase> findActiveNamedByInitiative(UUID initiativeId) {
    return list(
        "initiativeId = ?1 and implicit = false and archivedAt is null and deletedAt is null"
            + " order by createdAt, id",
        initiativeId);
  }

  @Override
  public Optional<Phase> findActiveNamedByIdAndUser(UUID id, UUID userId) {
    return find(
            IN_ACTIVE_INITIATIVE_OF_USER + " and archivedAt is null and deletedAt is null",
            id,
            userId)
        .firstResultOptional();
  }

  @Override
  public Optional<Phase> findNamedByIdAndUserForUpdate(UUID id, UUID userId) {
    return find(IN_ACTIVE_INITIATIVE_OF_USER, id, userId)
        .withLock(LockModeType.PESSIMISTIC_WRITE)
        .firstResultOptional();
  }
}
