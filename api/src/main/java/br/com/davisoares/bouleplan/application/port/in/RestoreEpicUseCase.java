package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.Optional;
import java.util.UUID;

/** Applies to a deleted epic; one that is not deleted is a no-op of the current user. */
public interface RestoreEpicUseCase {

  /** The restored epic, or empty if the rules do not allow it. */
  Optional<Epic> restore(UUID id);
}
