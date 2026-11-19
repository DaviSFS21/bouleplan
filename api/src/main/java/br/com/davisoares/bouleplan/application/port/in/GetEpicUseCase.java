package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.Optional;
import java.util.UUID;

/** Reads one epic of the current user. */
public interface GetEpicUseCase {

  /** The epic if it is named, active and in an active initiative of the user. */
  Optional<Epic> find(UUID id);
}
