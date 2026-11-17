package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.Optional;
import java.util.UUID;

/** Adds a named phase to an initiative of the current user. */
public interface CreatePhaseUseCase {

  /** The new phase, or empty if the initiative is not active and the user's. */
  Optional<Phase> create(UUID initiativeId, String name);
}
