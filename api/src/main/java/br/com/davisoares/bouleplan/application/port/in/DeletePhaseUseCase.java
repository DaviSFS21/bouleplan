package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.Optional;
import java.util.UUID;

/** Applies to an active phase of the current user. */
public interface DeletePhaseUseCase {

  /** The deleted phase, or empty if the rules do not allow it. */
  Optional<Phase> delete(UUID id);
}
