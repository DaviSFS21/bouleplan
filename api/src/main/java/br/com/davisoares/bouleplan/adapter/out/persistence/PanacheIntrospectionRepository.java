package br.com.davisoares.bouleplan.adapter.out.persistence;

import br.com.davisoares.bouleplan.application.port.out.IntrospectionRepository;
import br.com.davisoares.bouleplan.domain.Introspection;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/** Panache implementation of {@link IntrospectionRepository}. */
@ApplicationScoped
public class PanacheIntrospectionRepository
    implements IntrospectionRepository, PanacheRepositoryBase<Introspection, UUID> {

  @Override
  public void save(Introspection sheet) {
    persist(sheet);
  }

  @Override
  public Optional<Introspection> findByUserAndWeek(UUID userId, LocalDate weekStart) {
    return find("userId = ?1 and weekStart = ?2", userId, weekStart).firstResultOptional();
  }
}
