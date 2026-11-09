package br.com.davisoares.bouleplan.application.port.out;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.List;
import java.util.UUID;

/** Persistence port for initiatives. */
public interface InitiativeRepository {

  /** Persists a new initiative. */
  void save(Initiative initiative);

  /** Active initiatives of the user, oldest first. */
  List<Initiative> findActiveByUser(UUID userId);
}
