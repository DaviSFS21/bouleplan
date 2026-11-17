package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.Introspection;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for introspection sheets. */
public interface IntrospectionRepository {

  /** Persists a new sheet. */
  void save(Introspection sheet);

  /** The user's sheet of the week, if any. */
  Optional<Introspection> findByUserAndWeek(UUID userId, LocalDate weekStart);
}
