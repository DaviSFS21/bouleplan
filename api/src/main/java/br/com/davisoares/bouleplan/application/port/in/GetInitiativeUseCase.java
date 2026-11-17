package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.Optional;
import java.util.UUID;

/** Reads one initiative of the current user. */
public interface GetInitiativeUseCase {

  /** The initiative if it is active and owned by the current user. */
  Optional<Initiative> find(UUID id);
}
