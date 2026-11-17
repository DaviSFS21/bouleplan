package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.Optional;
import java.util.UUID;

/** Brings an archived initiative of the current user back. */
public interface UnarchiveInitiativeUseCase {

  /** The initiative (a no-op if already active), or empty if it is deleted, unknown or foreign. */
  Optional<Initiative> unarchive(UUID id);
}
