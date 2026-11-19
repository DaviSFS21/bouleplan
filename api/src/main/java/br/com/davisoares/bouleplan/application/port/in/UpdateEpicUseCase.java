package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.Optional;
import java.util.UUID;

/** Updates an active epic of the current user. */
public interface UpdateEpicUseCase {

  /** The updated epic, or empty if it is not an active epic of the user. */
  Optional<Epic> update(UUID id, UpdateEpicCommand command);
}
