package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Initiative;
import java.util.Optional;
import java.util.UUID;

/** Soft-deletes an active initiative of the current user. */
public interface DeleteInitiativeUseCase {

  /** The deleted initiative, or empty if it is not an active initiative of the user. */
  Optional<Initiative> delete(UUID id);
}
