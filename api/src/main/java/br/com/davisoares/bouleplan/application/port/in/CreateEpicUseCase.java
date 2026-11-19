package br.com.davisoares.bouleplan.application.port.in;

import br.com.davisoares.bouleplan.domain.Epic;
import java.util.Optional;
import java.util.UUID;

/** Adds a named epic to an initiative of the current user. */
public interface CreateEpicUseCase {

  /** The new epic, or empty if the initiative is not active and the user's. */
  Optional<Epic> create(UUID initiativeId, String name);
}
