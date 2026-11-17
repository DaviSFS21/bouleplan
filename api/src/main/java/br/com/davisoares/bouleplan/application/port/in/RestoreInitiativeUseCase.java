package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.Optional;
import java.util.UUID;

/** Restores a deleted initiative of the current user. */
public interface RestoreInitiativeUseCase {

  /** The initiative (a no-op if not deleted), or empty if it is unknown or foreign. */
  Optional<Initiative> restore(UUID id);
}
