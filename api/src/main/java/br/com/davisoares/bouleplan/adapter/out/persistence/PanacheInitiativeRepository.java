package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.InitiativeRepository;
import br.com.davisoares.bouleplan.domain.Initiative;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;

/** Panache implementation of {@link InitiativeRepository}. */
@ApplicationScoped
public class PanacheInitiativeRepository
    implements InitiativeRepository, PanacheRepositoryBase<Initiative, UUID> {

  @Override
  public void save(Initiative initiative) {
    persist(initiative);
  }

  @Override
  public List<Initiative> findActiveByUser(UUID userId) {
    return list(
        "userId = ?1 and archivedAt is null and deletedAt is null order by createdAt, id", userId);
  }
}
