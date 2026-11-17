package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.Optional;
import java.util.UUID;

/** Reads one phase of the current user. */
public interface GetPhaseUseCase {

  /** The phase if it is named, active and in an active initiative of the user. */
  Optional<Phase> find(UUID id);
}
