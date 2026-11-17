package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Persistence port for initiatives. */
public interface InitiativeRepository {

  /** Persists a new initiative. */
  void save(Initiative initiative);

  /** Active initiatives of the user, oldest first. */
  List<Initiative> findActiveByUser(UUID userId);

  /** An active initiative of the user by id. */
  Optional<Initiative> findActiveByIdAndUser(UUID id, UUID userId);
}
