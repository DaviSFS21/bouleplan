package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Phase;
import java.util.Optional;
import java.util.UUID;

/** Applies to an archived phase; an active one is a no-op of the current user. */
public interface UnarchivePhaseUseCase {

  /** The unarchived phase, or empty if the rules do not allow it. */
  Optional<Phase> unarchive(UUID id);
}
