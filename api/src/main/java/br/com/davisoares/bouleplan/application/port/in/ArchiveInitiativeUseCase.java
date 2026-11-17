package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.Optional;
import java.util.UUID;

/** Archives an active initiative of the current user. */
public interface ArchiveInitiativeUseCase {

  /** The archived initiative, or empty if it is not an active initiative of the user. */
  Optional<Initiative> archive(UUID id);
}
