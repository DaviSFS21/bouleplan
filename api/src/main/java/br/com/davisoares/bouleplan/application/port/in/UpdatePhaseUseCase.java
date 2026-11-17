package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.Optional;
import java.util.UUID;

/** Updates an active phase of the current user. */
public interface UpdatePhaseUseCase {

  /** The updated phase, or empty if it is not an active phase of the user. */
  Optional<Phase> update(UUID id, UpdatePhaseCommand command);
}
