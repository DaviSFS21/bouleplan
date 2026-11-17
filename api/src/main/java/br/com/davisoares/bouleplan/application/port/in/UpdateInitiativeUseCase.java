package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.Optional;
import java.util.UUID;

/** Edits an active initiative of the current user. */
public interface UpdateInitiativeUseCase {

  /** The updated initiative, or empty if it is not an active initiative of the user. */
  Optional<Initiative> update(UUID id, UpdateInitiativeCommand command);
}
