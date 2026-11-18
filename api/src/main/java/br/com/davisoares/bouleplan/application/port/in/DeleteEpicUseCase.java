package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.Optional;
import java.util.UUID;

/** Applies to an active epic of the current user. */
public interface DeleteEpicUseCase {

  /** The deleted epic, or empty if the rules do not allow it. */
  Optional<Epic> delete(UUID id);
}
