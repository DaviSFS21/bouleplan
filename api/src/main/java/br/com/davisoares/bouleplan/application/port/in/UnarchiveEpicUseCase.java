package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.Optional;
import java.util.UUID;

/** Applies to an archived epic; an active one is a no-op of the current user. */
public interface UnarchiveEpicUseCase {

  /** The unarchived epic, or empty if the rules do not allow it. */
  Optional<Epic> unarchive(UUID id);
}
