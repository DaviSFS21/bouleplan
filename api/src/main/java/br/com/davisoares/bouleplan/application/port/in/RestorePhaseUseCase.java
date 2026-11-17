package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.Optional;
import java.util.UUID;

/** Applies to a deleted phase; one that is not deleted is a no-op of the current user. */
public interface RestorePhaseUseCase {

  /** The restored phase, or empty if the rules do not allow it. */
  Optional<Phase> restore(UUID id);
}
